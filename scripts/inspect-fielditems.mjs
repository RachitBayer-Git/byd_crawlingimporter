import fs from 'fs';
import { load } from 'cheerio';
import { getComponentTypeClass } from '../utils/index.js';

const html = fs.readFileSync(new URL('../Input/country-divisional-heads-cdh.html', import.meta.url), 'utf-8');
const $ = load(html);

const items = $('.node__content > .field > .field__item');
console.log('Found items count:', items.length);
items.each((i, el) => {
  const type = getComponentTypeClass($, el) || '(none)';
  console.log(i, type, '--- snippet ---');
  console.log($(el).html().trim().slice(0, 300).replace(/\n/g,' '));
  console.log('--------------------');
});
