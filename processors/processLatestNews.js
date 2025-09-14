import { isComponentType, normalizeUrl } from '../utils/index.js';

export default function processLatestNews($, fieldItem, mainComponents, baseUrl) {
  // match paragraph type for latest news
  if (!isComponentType($, fieldItem, 'latest-news')) {
    return false;
  }

  // headline (there may be a title field)
  const headlineEl = $(fieldItem).find('.field--name-field-title.field__item').first();
  const headline = headlineEl.length ? headlineEl.text().trim() : null;

  const newsItems = [];
  // news articles are inside .news-wrapper .view-content article nodes
  $(fieldItem).find('.view-content article').each((i, art) => {
    const $art = $(art);
    // date
  // find a <time> element inside the article; some markup places the time on the same element
  const dateEl = $art.find('time').first();
  const date = dateEl.length ? (dateEl.attr('datetime') || dateEl.text().trim()) : null;
    // title
    const title = $art.find('.news-item-title').first().text().trim() || null;
    // link
    let link = $art.attr('about') || $art.find('a').first().attr('href') || null;
    if (link && !/^https?:\/\//.test(link)) {
      link = normalizeUrl(link, baseUrl);
    }
    // readMore label
    const readMore = $art.find('.read-more').first().text().trim() || null;

    newsItems.push({ date, title, link, readMore });
  });

  const obj = { type: 'Latest News' };
  if (headline) obj.headline = headline;
  obj.items = newsItems;

  mainComponents.push(obj);
  return true;
}
