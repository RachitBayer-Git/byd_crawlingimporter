import { isComponentType } from '../utils/index.js';

export default function processLinkList2($, fieldItem, mainComponents) {
  // Check if is link list
  if (!isComponentType($, fieldItem, 'link-list')) {
    return false;
  }

  let title = $(fieldItem).find('.field--name-field-title').first().text().trim();
  let links = [];
  $(fieldItem).find('a').each((i, link) => {
    let linkUrl = $(link).attr('href') || null;
    let linkText = $(link).text().trim();
    links.push({ url: linkUrl, text: linkText });
  });

  mainComponents.push({ type: 'Link List Alternative', title, links });
  return true;
}
