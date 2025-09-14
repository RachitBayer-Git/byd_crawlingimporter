import fs from 'fs';
import { load } from 'cheerio';
import { getComponentTypeClass } from '../utils/index.js';

const html = fs.readFileSync(new URL('../Input/community.html', import.meta.url), 'utf8');
const $ = load(html);

$('.node__content > .field > .field__item').each((i, fieldItem) => {
  const classes = $(fieldItem).attr('class') || '';
  const computed = getComponentTypeClass($, fieldItem);
  console.log(`#${i} classes=`, classes);
  console.log(`#${i} computed=`, computed);
});
