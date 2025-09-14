import { isComponentType } from '../utils/index.js';
import { normalizeUrl } from '../utils/index.js';

export default function processJumbotron($, fieldItem, mainComponents, baseUrl) {
  // Check if is grid layout
  if (!isComponentType($, fieldItem, 'jumbotron')) {
    return false;
  }

  // Jumbotron
  let title = $(fieldItem).find('h1, h2, h3, h4, h5, .title').first().text().trim();
  let image = $(fieldItem).find('img').attr('src') || null;
  if (image && !/^https?:\/\//.test(image)) {
    try {
      const urlObj = new URL(baseUrl);
      image = urlObj.origin + image;
    } catch (e) {
      // fallback: leave as is
    }
  }
  mainComponents.push({ type: 'Jumbotron', title, image });

  return true;
}
