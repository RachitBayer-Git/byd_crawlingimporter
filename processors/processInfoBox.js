import { normalizeUrl } from '../utils/index.js';

export default function processInfoBox($, fieldItem, mainComponents, baseUrl) {
  // detect paragraph type on self or as descendant
  const isSelf = $(fieldItem).is('.paragraph--type--info-box');
  const isDesc = $(fieldItem).find('.paragraph--type--info-box').length > 0;
  if (!isSelf && !isDesc) return false;

  const root = isSelf ? $(fieldItem) : $(fieldItem).find('.paragraph--type--info-box').first();

  // intro/title may be in field--name-field-introduction or a nested title paragraph
  const intro = root.find('.field--name-field-introduction').first().text().trim() || null;

  // description/html content
  const descEl = root.find('.field--name-field-description').first();
  const html = descEl && descEl.length ? descEl.html().trim() : null;
  const text = descEl && descEl.length ? descEl.text().trim() : null;

  // extract any links inside description
  const links = [];
  if (descEl && descEl.length) {
    descEl.find('a').each((i, a) => {
      const $a = $(a);
      links.push({ text: $a.text().trim() || null, url: normalizeUrl($a.attr('href') || null, baseUrl) });
    });
  }
  const obj = { type: 'Info Box' };

  if (intro) obj.intro = intro;
  if (html) obj.html = html;
  if (text) obj.text = text;
  if (links.length) obj.links = links;

  mainComponents.push(obj);
  return true;
}
