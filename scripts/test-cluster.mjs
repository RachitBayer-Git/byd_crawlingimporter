import fs from 'fs';
import { load } from 'cheerio';
import processClusterBlock from '../processors/processClusterBlock.js';

const html = fs.readFileSync(new URL('../Input/early-careersgraduates.html', import.meta.url), 'utf-8');
const $ = load(html);
const mainComponents = [];

$('.paragraph--type--cluster-composition').each((i, el) => {
  const fieldItem = $(el).closest('.field__item').get(0) || el;
  processClusterBlock($, fieldItem, mainComponents, 'https://www.bayer.co.uk/en/gb/career/early-careersgraduates');
});

console.log(JSON.stringify(mainComponents, null, 2));
