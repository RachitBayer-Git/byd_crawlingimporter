import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import axios from 'axios';
import { load } from 'cheerio';
import { processMainContentItem } from './processors/index.js';
import processMiddleColumnContentItem from './processors/processMiddleColumnContentItem.js';
import { loadUrls } from './utils/loadUrls.js';
// Minimal diagnostics: only track skipped URLs (pages with zero recognized components)
const liveDiagnostics = { skippedUrls: [] };
import { HEADERS } from './config.js';

// Config
const CONTENT_ROOT = path.resolve('./en'); // root folder containing page folders (exported JSON). If missing, we fall back to live mode.
// Optional first CLI argument: path to urls file. Defaults to ./urls.txt if not provided
const URLS_FILE_ARG = process.argv[2];
const URLS_FILE = path.resolve(URLS_FILE_ARG || './urls.txt'); // list of site URLs to include (one per line)
const OUTPUT_FILE = path.resolve('./components-report.xlsx');

/**
 * Recursively walk through a directory collecting paths to data.json files.
 * A page directory is assumed to contain a data.json file with metadata.url and components array.
 */
function collectPageDataJsonFiles(rootDir) {
  const results = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      // Recurse
      results.push(...collectPageDataJsonFiles(full));
    } else if (entry.isFile() && entry.name === 'data.json') {
      results.push(full);
    }
  }
  return results;
}

// Exclusion list for container/structural wrappers we don't want as their own row
const EXCLUDED_COMPONENT_TYPES = new Set([
  'Three Columns', 'three-columns', 'ThreeColumns'
]);

/**
 * Depth-first traversal preserving order and duplicates.
 * For each node with a type (unless excluded) we emit a row descriptor.
 * Children are walked in the original property order, prioritizing known collection keys first.
 */
function traverseComponents(rootArray, emit) {
  if (!Array.isArray(rootArray)) return;
  const visit = (node, depth, pathTypes) => {
    if (!node || typeof node !== 'object') return;
    const currentType = typeof node.type === 'string' ? node.type.trim() : null;
    const newPath = currentType ? [...pathTypes, currentType] : pathTypes;
    if (currentType && !EXCLUDED_COMPONENT_TYPES.has(currentType)) {
      emit({ type: currentType, depth, path: newPath });
    }
    // Determine child collections: arrays inside well-known keys, then any other arrays/objects
    const PRIORITY_KEYS = ['components', 'blocks', 'items', 'children', 'ctas', 'paragraphEntries'];
    for (const key of PRIORITY_KEYS) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(child => visit(child, depth + 1, newPath));
      }
    }
    // Fallback: walk other object/array properties not already processed
    for (const [k, v] of Object.entries(node)) {
      if (PRIORITY_KEYS.includes(k)) continue;
      if (!v || typeof v !== 'object') continue;
      if (Array.isArray(v)) {
        v.forEach(child => visit(child, depth + 1, newPath));
      } else {
        // Single nested object (might hold further structure)
        visit(v, depth + 1, newPath);
      }
    }
  };
  rootArray.forEach(node => visit(node, 0, []));
}

// Use shared URL loader; return Set for compatibility with existing code paths
function loadAllowedUrls() {
  if (!fs.existsSync(URLS_FILE)) {
    console.warn('URL list file not found, proceeding with all pages (exported JSON mode only). Expected at', URLS_FILE);
    return null; // maintain previous behavior: null means "no restriction" in exported JSON mode; but live mode will abort
  }
  const urls = loadUrls(URLS_FILE, { warn: true });
  if (!urls.length) {
    console.warn('URL file contained no valid URLs.');
    return new Set();
  }
  return new Set(urls);
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS });
    return res.data;
  } catch (e) {
    console.warn('Failed to fetch', url, e.message);
    return null;
  }
}

async function buildReport() {
  const allowed = loadAllowedUrls();
  if (allowed) console.log(`Loaded ${allowed.size} allowed URLs from urls file`);

  // Header
  const rows = [['Page URL', 'Component Name']];
  let pageCount = 0;
  let occurrenceCount = 0;

  const hasContentRoot = fs.existsSync(CONTENT_ROOT);
  let files = [];
  if (hasContentRoot) {
    try {
      files = collectPageDataJsonFiles(CONTENT_ROOT);
    } catch {}
  }

  if (files.length > 0) {
    console.log(`Using exported JSON mode. Found ${files.length} data.json files.`);
    for (const file of files) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        const json = JSON.parse(raw);
        let pageUrl = normalizeUrl(json?.metadata?.url || '(missing url)');
        if (allowed && !allowed.has(pageUrl)) continue;
        const components = json.components || [];
        if (!Array.isArray(components) || components.length === 0) continue;
        pageCount++;
        traverseComponents(components, ({ type }) => {
          occurrenceCount += 1;
          rows.push([pageUrl, type]);
        });
      } catch (e) {
        console.warn('Failed to process', file, e.message);
      }
    }
  } else {
    // Live mode
    console.log('No exported JSON found. Falling back to live fetch mode.');
    if (!allowed) {
      console.error('Live mode requires a URL list file to be present. Aborting.');
      process.exit(1);
    }
    if (allowed.size === 0) {
      console.error('Live mode URL file had no valid entries. Aborting.');
      process.exit(1);
    }
    const missingComponentImplementations = {}; // capture counts
    for (const pageUrl of allowed) {
      const html = await fetchHtml(pageUrl);
      if (!html) continue;
      const $ = load(html);
      const mainComponents = [];
      const orderedComponents = [];
      $('.node__content > .field > .field__item').each((i, fieldItem) => {
        const beforeCount = mainComponents.length;
        const diagnostics = null; // diagnostics suppressed
        // We call the higher-level main content processor first
        const processed = processMainContentItem($, fieldItem, mainComponents, missingComponentImplementations, pageUrl, orderedComponents) ||
          processMiddleColumnContentItem($, fieldItem, mainComponents, missingComponentImplementations, pageUrl, diagnostics);
      });
      if (mainComponents.length) {
        pageCount++;
        traverseComponents(mainComponents, ({ type }) => {
          occurrenceCount += 1;
          rows.push([pageUrl, type]);
        });
      } else {
        liveDiagnostics.skippedUrls.push(pageUrl);
      }
    }
    // After live processing, log diagnostics
    if (liveDiagnostics.skippedUrls.length) {
      console.log('Live Mode: URLs with zero recognized components:', liveDiagnostics.skippedUrls.length);
      liveDiagnostics.skippedUrls.forEach(u => console.log('  (skipped)', u));
    }
  }

  // Ordering/grouping
  if (!allowed) {
    const header = rows.shift();
    const rest = rows;
    rest.sort((a, b) => a[0].localeCompare(b[0]));
    rows.length = 0; rows.push(header, ...rest);
  } else {
    const header = rows.shift();
    const byUrl = new Map();
    for (const r of rows) {
      if (!byUrl.has(r[0])) byUrl.set(r[0], []);
      byUrl.get(r[0]).push(r);
    }
    rows.length = 0; rows.push(header);
    for (const url of allowed) {
      const list = byUrl.get(url);
      if (list) list.forEach(r => rows.push(r));
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'PageComponents');
  XLSX.writeFile(wb, OUTPUT_FILE);
  console.log(`Report written to ${OUTPUT_FILE}`);
  console.log(`Pages with components: ${pageCount}`);
  console.log(`Total component occurrences: ${occurrenceCount}`);
  console.log('Mode:', files.length > 0 ? 'exported-json' : 'live');
}

buildReport();
