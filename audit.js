import fs from 'fs';
import path from 'path';
import axios from 'axios';
import XLSX from 'xlsx';
import { load } from 'cheerio';
import { HEADERS, DEFAULT_URLS_FILE } from './config.js';
import { loadUrls } from './utils/loadUrls.js';
import { getComponentTypeClass } from './utils/index.js';
import processMainContentItem from './processors/processMainContentItem.js';
import processMiddleColumnContentItem from './processors/processMiddleColumnContentItem.js';

/**
 * Normalize paragraph type (strip prefix if any stray chars) and return lowercase slug
 */
function extractParagraphType(el) {
  const cls = (el.attribs && el.attribs.class) || '';
  const parts = cls.split(/\s+/).filter(Boolean);
  const par = parts.find(p => p.startsWith('paragraph--type--'));
  if (!par) return null;
  return par.substring('paragraph--type--'.length).trim();
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS });
    return res.data;
  } catch (e) {
    console.warn('Fetch failed', url, e.message);
    return null;
  }
}

async function main() {
  const urlsFile = process.argv[2] || DEFAULT_URLS_FILE;
  const urls = loadUrls(urlsFile, { warn: true });
  if (!urls.length) {
    console.error('No valid URLs found in', urlsFile);
    process.exit(1);
  }
  console.log(`Loaded ${urls.length} URLs for audit from ${urlsFile}`);

  const stats = {}; // paragraphType -> { occurrences, handled, urls:Set, unhandledUrls:Set }

  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const $ = load(html);

    // Collect all paragraph elements inside node__content
    $('.node__content [class*="paragraph--type--"]').each((i, el) => {
      const type = extractParagraphType(el);
      if (!type) return;
      if (!stats[type]) stats[type] = { occurrences: 0, handled: 0, urls: new Set(), unhandledUrls: new Set() };
      stats[type].occurrences++; stats[type].urls.add(url);
    });

    // Now attempt to process top-level field items similar to index.js
    const missingComponentImplementations = {};
    const dummyComponents = [];
    const orderedComponents = [];

    $('.node__content > .field > .field__item').each((i, fieldItem) => {
      const componentName = getComponentTypeClass($, fieldItem) || null;
      if (!componentName) return;
      // Attempt main content processors
      let processed = processMainContentItem($, fieldItem, dummyComponents, missingComponentImplementations, url, orderedComponents);
      if (!processed) {
        // Attempt middle column processors directly if main failed
        processed = processMiddleColumnContentItem($, fieldItem, dummyComponents, missingComponentImplementations, url, null);
      }
      if (componentName && stats[componentName]) {
        if (processed) {
          stats[componentName].handled++; // mark handled for that paragraph type
        } else {
          stats[componentName].unhandledUrls.add(url);
        }
      }
    });
  }

  // Prepare rows
  const header = ['Paragraph Type', 'Occurrences', 'Handled', 'Unhandled', 'Example URL (Unhandled)', 'All URLs (comma-separated, truncated)'];
  const rows = [header];
  Object.keys(stats).sort().forEach(type => {
    const { occurrences, handled, unhandledUrls, urls } = stats[type];
    const unhandled = Math.max(occurrences - handled, unhandledUrls.size); // conservative
    const example = unhandledUrls.size ? Array.from(unhandledUrls)[0] : '';
    const urlList = Array.from(urls).slice(0, 10).join(', ')+(urls.size>10?' ...':'');
    rows.push([type, occurrences, handled, unhandled, example, urlList]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Audit');

  const output = path.resolve('./components-audit.xlsx');
  XLSX.writeFile(wb, output);
  console.log('Audit written to', output);

  // Console summary for unhandled
  const unhandledList = Object.entries(stats).filter(([t,v]) => (v.occurrences - v.handled) > 0 || v.unhandledUrls.size > 0);
  if (unhandledList.length) {
    console.log('Potentially unhandled paragraph types:');
    unhandledList.forEach(([t,v]) => {
      const unhandled = Math.max(v.occurrences - v.handled, v.unhandledUrls.size);
      console.log(`  ${t} - occurrences=${v.occurrences} handled=${v.handled} unhandled~=${unhandled}`);
    });
  } else {
    console.log('All paragraph types appear to be handled by existing processors (based on heuristic).');
  }
}

main();
