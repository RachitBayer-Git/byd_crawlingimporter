import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import processMainContentItem from '../processors/processMainContentItem.js';

const inputPath = path.join('Input', 'media.html');
const outPath = path.join('en', 'media', 'data.json');
const html = fs.readFileSync(inputPath, 'utf8');
const $ = load(html);

const mainComponents = [];
const missing = {};

$('.node__content > .field > .field__item').each((i, fieldItem) => {
  processMainContentItem($, fieldItem, mainComponents, missing, 'https://www.bayer.co.uk', []);
});

const out = { metadata: {}, components: mainComponents };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath, 'components:', mainComponents.length);
console.log('missingComponentImplementations:', JSON.stringify(missing, null, 2));
