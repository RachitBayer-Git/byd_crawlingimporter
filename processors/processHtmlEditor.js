import { isComponentType } from '../utils/index.js';

export default function processHtmlEditor($, fieldItem, mainComponents) {
  // Check if is HTML Editor
  if (!isComponentType($, fieldItem, 'html-editor')) {
    return false;
  }

  let html = $(fieldItem).find('.field--name-field-html-editor').html();
  let text = $(fieldItem).find('.field--name-field-html-editor').text().trim();
  let title = $(fieldItem).find('.paragraph--type--title').first().text().trim();

  mainComponents.push({ type: 'HTML Editor', title, html, text });
  return true;
}
