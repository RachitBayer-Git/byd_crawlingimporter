import { isComponentType, normalizeUrl } from '../utils/index.js';

export default function processLocalNewsContent($, fieldItem, mainComponents, baseUrl) {
  if (!isComponentType($, fieldItem, 'local-news-content')) return false;

  const items = [];
  // the view contains article nodes for each news teaser
  $(fieldItem).find('.view-content article').each((i, art) => {
    const $art = $(art);
    const dateEl = $art.find('time').first();
    const date = dateEl.length ? (dateEl.attr('datetime') || dateEl.text().trim()) : null;

    // title is often inside .news-title h4 or .news-title
    let title = $art.find('.news-title').first().text().trim() || null;
    if (!title) title = $art.find('h4, h3, h2').first().text().trim() || null;

    let link = $art.attr('about') || $art.find('a').first().attr('href') || null;
    if (link && !/^https?:\/\//.test(link)) link = normalizeUrl(link, baseUrl);

    // summary/introduction if present
    const summaryEl = $art.find('.field--name-field-sublines .field__item, .text-formatted.field__item').first();
    const summary = summaryEl && summaryEl.length ? summaryEl.text().trim() : null;

    items.push({ date, title, link, summary });
  });

  const obj = { type: 'Local News', items };
  mainComponents.push(obj);
  return true;
}
