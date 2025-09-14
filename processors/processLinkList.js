import { isComponentType } from '../utils/index.js';

export default function processLinkList($, fieldItem, mainComponents) {
  // Check if is link list
  if (!isComponentType($, fieldItem, 'list-links')) {
    return false;
  }

  let title = $(fieldItem).find('.field--name-field-title').first().text().trim();
  let description = $(fieldItem).find('.field--name-field-description').first().html();
  let links = [];
  $(fieldItem).find('a').each((i, link) => {
    let linkUrl = $(link).attr('href') || null;
    let linkText = $(link).text().trim();
    links.push({ url: linkUrl, text: linkText });
  });

  mainComponents.push({ type: 'List Links', title, description, links });
  return true;
}
