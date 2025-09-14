import { isComponentType } from '../utils/index.js';

export default function processSectionIntroduction($, fieldItem, mainComponents) {
  // Check if is section introduction
  if (!isComponentType($, fieldItem, 'section-introduction')) {
    return false;
  }

  let title = $(fieldItem).find('.field--name-field-title').first().text().trim();
  let image = $(fieldItem).find('.field--name-field-media').find('img').attr('src') || null;

  mainComponents.push({ type: 'Section Introduction', title, image });
  return true;
}
