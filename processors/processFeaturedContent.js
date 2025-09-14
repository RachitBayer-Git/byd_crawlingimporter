import { isComponentType } from '../utils/index.js';

export default function processFeaturedContent($, fieldItem, mainComponents, baseUrl) {
  // Check if is featured content
  if (!isComponentType($, fieldItem, 'featured-contents')) {
    return false;
  }
  
  let title = $(fieldItem).find('.field--name-field-title').first().text().trim();
  let ctas = [];
  // CTAs are embedded in .field__item elements within .field--name-field-featured-contents
  $(fieldItem).find('.field--name-field-featured-contents > .field__item').slice(0, 3).each((i, ctaItem) => {
    let ctaLink = $(ctaItem).find('a').attr('href') || null;
    if (ctaLink && !/^https?:\/\//.test(ctaLink)) {
      try {
        const urlObj = new URL(baseUrl);
        ctaLink = urlObj.origin + ctaLink;
      } catch (e) {
        // fallback: leave as is
      }
    }
    let ctaImage = $(ctaItem).find('img').attr('src') || null;
    if (ctaImage && !/^https?:\/\//.test(ctaImage)) {
      try {
        const urlObj = new URL(baseUrl);
        ctaImage = urlObj.origin + ctaImage;
      } catch (e) {
        // fallback: leave as is
      }
    }
    let listingTitle = $(ctaItem).find('.listing-title, .field--name-field-listing-title').first().text().trim();
    // CTA link text - often inside a <span class="read-more"> or the anchor text
    let linkText = $(ctaItem).find('.read-more').first().text().trim();
    if (!linkText) {
      // fallback to anchor text
      linkText = $(ctaItem).find('a').first().text().trim() || null;
    }
    ctas.push({ link: ctaLink, image: ctaImage, listingTitle, linkText });
  });
  mainComponents.push({ type: 'Featured Contents', title, ctas });
  return true;
}
