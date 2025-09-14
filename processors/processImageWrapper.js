import { isComponentType } from '../utils/index.js';

export default function processImageWraper($, fieldItem, mainComponents, baseUrl) {
  // Check if is image wrapper
  if (!isComponentType($, fieldItem, 'image-wide')) {
    return false;
  } 

  // Image Wrapper
  const imageWrapper = $(fieldItem).find('.image-wide-image-wrapper').first();
  if (imageWrapper.length) {
    let text = imageWrapper.find('h1, h2, h3, strong, b').first().text().trim();
    if (!text) {
      text = imageWrapper.text().trim();
    }
    let description = imageWrapper.find('p').map((i, p) => $(p).text().trim()).get().join(' ');
    if (!description) {
      description = imageWrapper.clone().children().remove().end().text().trim();
      if (text && description.startsWith(text)) {
        description = description.slice(text.length).trim();
      }
    }
    let imageUrl = imageWrapper.find('img').attr('src') || null;
    if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
      try {
        const urlObj = new URL(baseUrl);
        imageUrl = urlObj.origin + imageUrl;
      } catch (e) {
        // fallback: leave as is
      }
    }
    mainComponents.push({ type: 'Image Wrapper', text, description, image: imageUrl });
  }
  return true;
}
