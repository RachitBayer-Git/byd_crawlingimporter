import { isComponentType } from '../utils/index.js';

export default function processMiniBanner($, fieldItem, mainComponents) {
  // Check if is image wrapper
  if (!isComponentType($, fieldItem, 'mini-banner')) {
    return false;
  } 

  // Mini Banner
  const title = $(fieldItem).find('.field--name-field-title').text().trim();
  const imageUrl = $(fieldItem).find('.field--name-field-image-media').find('img').attr('src') || null;

  mainComponents.push({ type: 'Mini Banner', title, image: imageUrl });
  return true;
}
