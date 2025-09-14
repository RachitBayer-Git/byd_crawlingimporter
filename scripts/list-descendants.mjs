import fs from 'fs';
import { load } from 'cheerio';
const html = fs.readFileSync(new URL('../Input/country-divisional-heads-cdh.html', import.meta.url), 'utf-8');
const $ = load(html);

$('.node__content > .field > .field__item').each((i, el) => {
  console.log('FieldItem', i);
  $(el).find('[class*="paragraph--type--"]').each((j, d) => {
    const cls = $(d).attr('class') || '';
    const parts = cls.split(/\s+/).filter(Boolean);
    const para = parts.find(p => p.indexOf('paragraph--type--') === 0);
    console.log('  ', j, para || cls);
  });
});
