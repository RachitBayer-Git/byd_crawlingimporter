import { isComponentType } from '../utils/index.js';

export default function processTextWithImage($, fieldItem, mainComponents, baseUrl, diagnostics) {
  // Check if is Text With Image
  // If an accordion container is present, defer to accordion processors (avoid misclassification)
  if (isComponentType($, fieldItem, 'accordion') || isComponentType($, fieldItem, 'accordion-item')) {
    return false; // silently skip; accordion processor handles it
  }
  if (!isComponentType($, fieldItem, 'text-with-image')) {
    return false; // not this component
  }

  let image = $(fieldItem).find('img').attr('src') || null;
  if (image && !/^https?:\/\//.test(image)) {
    try {
      const urlObj = new URL(baseUrl);
      image = urlObj.origin + image;
    } catch (e) {
      // fallback: leave as is
    }
  }

  // support either 'field--name-field-text-content' or 'field--name-field-introduction'
  let richText = $(fieldItem).find('.field--name-field-text-content').first();
  if (!richText || !richText.length) {
    richText = $(fieldItem).find('.field--name-field-introduction').first();
  }
  let title = $(fieldItem).find('.paragraph--type--title').first().text().trim();
  let html = richText && richText.length ? richText.html() : null;
  let text = richText && richText.length ? richText.text().trim() : '';

  // Content validation: only export if at least one substantive field present
  const cleanHtmlText = html ? html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() : '';
  const hasImage = !!image;
  const hasTitle = !!title;
  const hasHtml = !!cleanHtmlText;
  const hasText = !!text.trim();
  if (!(hasImage || hasTitle || hasHtml || hasText)) {
    return false; // silently skip empty block
  }

  mainComponents.push({ type: 'Text With Image', image, title, html, text });

  return true;
}
