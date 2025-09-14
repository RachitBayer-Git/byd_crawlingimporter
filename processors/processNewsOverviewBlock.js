import { normalizeUrl } from '../utils/index.js';

export default function processNewsOverviewBlock($, fieldItem, mainComponents, baseUrl) {
  // match paragraph type for news overview block. The paragraph class may be on the
  // fieldItem itself or on a descendant; handle both.
  const isSelf = $(fieldItem).is('.paragraph--type--news-overview-block');
  const isDesc = $(fieldItem).find('.paragraph--type--news-overview-block').length > 0;
  if (!isSelf && !isDesc) return false;

  const items = [];
  // Each article inside the view-content is a teaser
  $(fieldItem).find('.view-content article').each((i, art) => {
    const $art = $(art);
    const imgEl = $art.find('.news-img img').first();
    let image = null;
    if (imgEl && imgEl.length) {
      const src = imgEl.attr('src') || imgEl.attr('data-src') || null;
      image = src ? normalizeUrl(src, baseUrl) : null;
    }

    const timeEl = $art.find('time').first();
    const date = timeEl && timeEl.length ? (timeEl.attr('datetime') || timeEl.text().trim()) : null;

    const topline = $art.find('.news-topline').first().text().trim() || null;
    const title = $art.find('.news-title').first().text().replace(/\s+/g, ' ').trim() || null;

    let link = $art.attr('about') || $art.find('.news-links a').first().attr('href') || $art.find('a').first().attr('href') || null;
    if (link && !/^https?:\/\//.test(link)) {
      link = normalizeUrl(link, baseUrl);
    }

    const readMore = $art.find('.read-more').first().text().trim() || null;

    items.push({ date, topline, title, link, readMore, image });
  });

  // pagination info (optional)
  const pageRange = $(fieldItem).find('.pagination-count .page-count').first().text().trim() || null;
  const totalCountText = $(fieldItem).find('.pagination-count .total-news-count').first().text().trim() || null;
  let total = null;
  if (totalCountText) {
    const m = totalCountText.match(/(\d[\d,]*)/);
    if (m) total = parseInt(m[1].replace(/,/g, ''), 10);
  }

  const obj = { type: 'News Overview' };
  if (items.length) obj.items = items;
  if (pageRange) obj.pageRange = pageRange;
  if (total !== null) obj.total = total;

  mainComponents.push(obj);
  return true;
}
