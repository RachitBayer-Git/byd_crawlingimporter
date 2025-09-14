import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';
import processClusterBlock from '../processors/processClusterBlock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, '..', 'Input', 'early-careersgraduates.html');
const outPath = path.join(__dirname, '..', 'en', 'gb', 'career', 'early-careersgraduates', 'data.json');

const html = fs.readFileSync(inputPath, 'utf8');
const $ = load(html);

const mainComponents = [];
// find the cluster paragraph nodes (matches test-cluster.mjs)
$('.paragraph--type--cluster-composition').each((i, el) => {
  const fieldItem = $(el).closest('.field__item').get(0) || el;
  processClusterBlock($, fieldItem, mainComponents, 'https://www.bayer.co.uk');
});

// preserve existing metadata if present
let existingMeta = {};
try {
  const existing = fs.readFileSync(outPath, 'utf8');
  const parsed = JSON.parse(existing);
  if (parsed && parsed.metadata) existingMeta = parsed.metadata;
} catch (e) {
  // ignore - file may not exist or be invalid
}

const out = { metadata: existingMeta, components: mainComponents };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath, 'with', mainComponents.length, 'component(s)');
