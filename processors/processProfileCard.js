import { isComponentType, normalizeUrl } from '../utils/index.js';

export default function processProfileCard($, fieldItem, mainComponents, baseUrl) {
  if (!isComponentType($, fieldItem, 'profile-card')) return false;

  // profile-card may appear inside a grid-layout item; handle multiple profile-card in the same fieldItem
  const profiles = [];
  $(fieldItem).find('.paragraph--type--profile-card').each((i, card) => {
    const $card = $(card);
    // image attributes
    const $img = $card.find('img').first();
    let imageSrc = $img.attr('src') || null;
    if (imageSrc && !/^https?:\/\//.test(imageSrc)) {
      imageSrc = normalizeUrl(imageSrc, baseUrl);
    }
    const imageAlt = $img.attr('alt') || null;
    const imageWidth = $img.attr('width') || $img.attr('data-width') || null;
    const imageHeight = $img.attr('height') || $img.attr('data-height') || null;

    const name = $card.find('.field--name-field-title').first().text().trim() || null;
    const role = $card.find('.field--name-field-short-description').first().text().trim() || null;

    // link: prefer href, then data-no-tracking-url, else null
    let link = null;
    const $a = $card.find('a').first();
    if ($a && $a.length) {
      const href = ($a.attr('href') || '').trim();
      const dataNoTrack = ($a.attr('data-no-tracking-url') || '').trim();
      if (href) link = href;
      else if (dataNoTrack) link = dataNoTrack;
    }
    if (link && !/^https?:\/\//.test(link)) {
      link = normalizeUrl(link, baseUrl);
    }

    // link text / read-more
    let linkText = $card.find('.read-more').first().text().trim() || null;
    if (!linkText) {
      linkText = $a && $a.length ? $a.text().trim() || null : null;
    }

    profiles.push({ name, role, image: { src: imageSrc, alt: imageAlt, width: imageWidth, height: imageHeight }, link, linkText });
  });

  if (profiles.length) {
    // If invoked from grid layout, attach to mainComponents as a Profile List
    mainComponents.push({ type: 'Profile List', profiles });
    return true;
  }

  return false;
}
