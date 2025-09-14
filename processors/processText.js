import { isComponentType } from '../utils/index.js';

export default function processText($, fieldItem, mainComponents) {
  // Check if is Text
  if (!isComponentType($, fieldItem, 'text')) return false;

  // support either 'field--name-field-text-content' or 'field--name-field-introduction'
  let richText = $(fieldItem).find('.field--name-field-text-content').first();
  if (!richText || !richText.length) {
    richText = $(fieldItem).find('.field--name-field-introduction').first();
  }
  const title = $(fieldItem).find('.paragraph--type--title').first().text().trim() || null;
  const html = richText && richText.length ? richText.html() : null;
  const text = richText && richText.length ? richText.text().trim() : null;

  const obj = { type: 'Text' };
  if (title) obj.title = title;
  if (html) obj.html = html;
  if (text) obj.text = text;

  mainComponents.push(obj);
  return true;
}
