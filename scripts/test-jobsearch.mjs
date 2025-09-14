import fs from 'fs';
import { load } from 'cheerio';
import processJobSearch from '../processors/processJobSearch.js';

const html = fs.readFileSync(new URL('../Input/early-careersgraduates.html', import.meta.url), 'utf-8');
const $ = load(html);
const mainComponents = [];

// find the job-search paragraph and pass the wrapping .field__item (same as production)
$('.paragraph--type--job-search').each((i, el) => {
  const fieldItem = $(el).closest('.field__item').get(0) || el;
  processJobSearch($, fieldItem, mainComponents, 'https://www.bayer.co.uk/en/gb/career/early-careersgraduates');
});

console.log(JSON.stringify(mainComponents, null, 2));
