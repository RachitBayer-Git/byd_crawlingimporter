import fs from 'fs';
import { load } from 'cheerio';
import processMainContentItem from '../processors/processMainContentItem.js';

const html = fs.readFileSync(new URL('../Input/country-divisional-heads-cdh.html', import.meta.url), 'utf-8');
const $ = load(html);
const missing = {};
const mainComponents = [];

$('.node__content > .field > .field__item').each((i, fieldItem) => {
  processMainContentItem($, fieldItem, mainComponents, missing, 'https://www.bayer.co.uk', []);
});

console.log('missingComponentImplementations:', JSON.stringify(missing, null, 2));
console.log('components found:', mainComponents.map(c => c.type));
