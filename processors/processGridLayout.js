import { isComponentType } from '../utils/index.js';

export default function processGridLayout($, fieldItem, mainComponents, orderedComponents = null, baseUrl) {
  // Check if is grid layout
  if (!isComponentType($, fieldItem, 'grid-layout')) {
    return false;
  }
  
  // Teaser List
  let teaserEntries = [];
  $(fieldItem).find('.paragraph--type--teaser-card').each((i, entry) => {
    let image = $(entry).find('img').attr('src') || null;
    let title = $(entry).find('.teaser-content-wrapper .field--name-field-title').first().text().trim();
    let content = $(entry).find('.teaser-content-wrapper .field--name-field-description').first().text().trim();
  // optional kicker (some teasers include a small kicker above the title)
  let kicker = $(entry).find('.field--name-field-kicker').first().text().trim() || null;
    let link = $(entry).find('a').attr('href') || null;

  // include kicker only if present (keeps output shape stable)
  teaserEntries.push(kicker ? { image, title, content, link, kicker } : { image, title, content, link });
  });
  let pushedSomething = false;
  if (teaserEntries.length) {
    const target = Array.isArray(orderedComponents) ? orderedComponents : (Array.isArray(mainComponents) ? mainComponents : null);
    if (target) {
      target.push({ type: 'Teaser List', teaserEntries });
    } else {
      try { mainComponents.push({ type: 'Teaser List', teaserEntries }); } catch (e) { }
    }
    pushedSomething = true;
  }

  // Paragraph List
  let paragraphEntries = [];
  $(fieldItem).find('.field__item > .paragraph--type--list-links').each((i, linkList) => {
    let title = $(linkList).find('.field--name-field-title').first().text().trim();
    let description = $(linkList).find('.field--name-field-description').first().html();
    let links = [];
    $(linkList).find('a').each((i, link) => {
      let linkUrl = $(link).attr('href') || null;
      let linkText = $(link).text().trim();
      links.push({ url: linkUrl, text: linkText });
    })
    paragraphEntries.push({ title, description, links });
  });

  if (paragraphEntries.length) {  
    mainComponents.push({ type: 'Paragraph List', paragraphEntries });
    pushedSomething = true;
  }
  // return true only if we actually produced components; otherwise let caller report missing implementations
  return pushedSomething;
}
