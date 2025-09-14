import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { processMainContentItem } from '../processors/index.js';

const inputPath = path.join('Input', 'home.html');
const outPath = path.join('en', 'data.json');
const html = fs.readFileSync(inputPath, 'utf8');
const $ = load(html);

const mainComponents = [];

// iterate same as index.js: top-level .node__content > .field > .field__item
$('.node__content > .field > .field__item').each((i, fieldItem) => {
  processMainContentItem($, fieldItem, mainComponents, {}, 'https://www.bayer.co.uk', []);
});

const out = { metadata: {}, components: mainComponents };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath, 'components:', mainComponents.length);
