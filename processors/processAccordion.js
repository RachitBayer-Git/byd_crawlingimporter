import { isComponentType } from '../utils/index.js';

export default function processAccordion($, fieldItem, mainComponents) {
  // Check if is accordion  
  if (!isComponentType($, fieldItem, 'accordion')) {
    return false;
  }

  // Accordion
  let entries = [];
  $(fieldItem).find('.field--name-field-accordion-item > .field__item').each((i, entry) => {
    let title = $(entry).find('.card-header').first().text().trim();
    let content = $(entry).find('.card-body .field--name-field-description').first().html() || null;
    if (!content) {
      content = $(entry).text().trim();
      if (title && content.startsWith(title)) {
        content = content.slice(title.length).trim();
      }
    }
    entries.push({ title, content });
  });

  mainComponents.push({ type: 'Accordion', entries });

  return true;
}
