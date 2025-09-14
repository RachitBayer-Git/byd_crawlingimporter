import { isComponentType } from '../utils/index.js';

export default function processJobSearch($, fieldItem, mainComponents, baseUrl) {
  // Check if is job-search
  if (!isComponentType($, fieldItem, 'job-search')) {
    return false;
  }

  const headline = $(fieldItem).find('.field--name-field-headline').first().text().trim();

  // Form (kept identical to original behaviour)
  const formEl = $(fieldItem).find('form.job-search-form').first();
  const form = {};
  if (formEl.length) {
    form.action = formEl.attr('action') || null;
    form.id = formEl.attr('id') || null;
    form.inputs = [];
    formEl.find('input').each((i, inp) => {
      const $inp = $(inp);
      form.inputs.push({
        name: $inp.attr('name') || null,
        id: $inp.attr('id') || null,
        placeholder: $inp.attr('placeholder') || null,
        value: $inp.attr('value') || ''
      });
    });
  }

  // Career links / suggestions
  // New approach: iterate the career-link paragraphs only and aggregate by title, deduplicating links.
  const careerMap = new Map();

  $(fieldItem).find('.paragraph--type--career-link').each((i, item) => {
    const $item = $(item);
    const title = $item.find('.field--name-field-title').first().text().trim() || null;
    const links = [];
    $item.find('a').each((j, a) => {
      const href = $(a).attr('href') || null;
      const text = $(a).text().trim();
      links.push({ text, url: href });
    });

    if (!careerMap.has(title)) {
      careerMap.set(title, new Map()); // map of url->linkObj to dedupe
    }
    const linkStore = careerMap.get(title);
    links.forEach(l => {
      const key = (l.url || '') + '||' + (l.text || '');
      if (!linkStore.has(key)) {
        linkStore.set(key, l);
      }
    });
  });

  // Also handle any remaining links that might be direct children under field--name-field-links
  // (defensive: in case some structures are outside career-link paragraphs)
  $(fieldItem).find('> .job-content-wrapper .field--name-field-links > .field__item').each((i, item) => {
    const $item = $(item);
    // try to find a nearby title; fallback to null
    const title = $item.closest('.paragraph--type--career-link').find('.field--name-field-title').first().text().trim() || null;
    const links = [];
    $item.find('a').each((j, a) => {
      links.push({ text: $(a).text().trim(), url: $(a).attr('href') || null });
    });
    if (links.length) {
      if (!careerMap.has(title)) careerMap.set(title, new Map());
      const linkStore = careerMap.get(title);
      links.forEach(l => {
        const key = (l.url || '') + '||' + (l.text || '');
        if (!linkStore.has(key)) linkStore.set(key, l);
      });
    }
  });

  // Convert map to array and preserve insertion order
  const careerLinks = Array.from(careerMap.entries()).map(([title, linkStore]) => {
    return { title, links: Array.from(linkStore.values()) };
  });

  mainComponents.push({ type: 'Job Search', headline, form, careerLinks });
  return true;
}
