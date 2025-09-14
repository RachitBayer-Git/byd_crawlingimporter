import { isComponentType } from '../utils/index.js';

export default function processQuote($, fieldItem, mainComponents) {
  // Check if is a quote
  if (!isComponentType($, fieldItem, 'quote')) {
    return false;
  } 

  // Mini Banner
  const quoteText = $(fieldItem).find('.field--name-field-text').text().trim();
  const quoteAuthor = $(fieldItem).find('.author-text-wrapper .field--name-field-title').text().trim();
  const quoteDesignation = $(fieldItem).find('.author-text-wrapper .field--name-field-author-designation').text().trim();

  mainComponents.push({ type: 'Quote', text: quoteText, author: quoteAuthor, designation: quoteDesignation });
  return true;
}
