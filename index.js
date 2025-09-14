import fs from 'fs';
import axios from 'axios';
import { load } from 'cheerio';
import path from 'path';
import { URL as NodeURL } from 'url';
import {
  processMainContentItem
} from './processors/index.js';
import { getComponentTypeClass } from './utils/index.js';
import { extractPageMetadata } from './utils/index.js';
import { HEADERS, DEFAULT_URLS_FILE, OUTPUT_FILENAME } from './config.js';
import { loadUrls } from './utils/loadUrls.js';

async function fetchContent(url) {
  try {
    const response = await axios.get(url, {
      headers: HEADERS
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching URL ${url}:`, error.message);
    return null;
  }
}

async function main() {
  const urlsFile = process.argv[2] || DEFAULT_URLS_FILE;
  const missingComponentImplementations = {};

  const urls = loadUrls(urlsFile);
  if (!urls.length) {
    console.error('No valid URLs found in file:', urlsFile);
    return;
  }

  for (const url of urls) {
    console.log(`Fetching content from: ${url}`);
    const html = await fetchContent(url);
    if (html) {
      console.log(`Content from ${url}:`);
  const $ = load(html);
      const mainComponents = [];
      const orderedComponents = [];
      // Iterate through .field__item children of .node__content
      $('.node__content > .field > .field__item').each((i, fieldItem) => {
        let processed = processMainContentItem($, fieldItem, mainComponents, missingComponentImplementations, url, orderedComponents);
      });

      try {
        const urlObj = new NodeURL(url);
        let pathParts = urlObj.pathname.split('/').filter(Boolean);
        let folderPath = path.join(process.cwd(), ...pathParts);
        fs.mkdirSync(folderPath, { recursive: true });
        let filePath = path.join(folderPath, OUTPUT_FILENAME);
        const metadata = extractPageMetadata($, url);
        const output = { metadata, components: mainComponents };
        fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
        console.log(`Saved JSON to: ${filePath}`);
      } catch (e) {
        console.error('Error saving JSON:', e);
      }
    }
  }

  console.log(`Missing Components: ${JSON.stringify({ missingComponentImplementations }, null, 2)}`);
}

main();
