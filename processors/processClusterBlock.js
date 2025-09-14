import { isComponentType } from '../utils/index.js';

export default function processClusterBlock($, fieldItem, mainComponents, baseUrl) {
  // Check if is cluster block
  if (!isComponentType($, fieldItem, 'cluster-composition')) {
    return false;
  }
  // Collect all cluster items in order
  const blocks = [];
  // extract optional cluster headline (top-level for the cluster)
  let clusterHeadline = null;
  const clusterHeadlineEl = $(fieldItem).find('.cluster_headline .field--name-field-headline.field__item').first();
  if (clusterHeadlineEl.length) {
    clusterHeadline = clusterHeadlineEl.text().trim() || null;
  }
  // cluster items live under .cluster-top-block .cluster-item or generic .cluster-item
  $(fieldItem).find('.cluster-item').each((i, item) => {
    const $item = $(item);
    // title (normalized: trim and remove trailing punctuation)
    let title = $item.find('.field--name-field-title').first().text().trim() || null;
    if (title) {
      // remove trailing punctuation and whitespace characters
      title = title.replace(/[\s\.\,\!\?\:\;\-\–\—]+$/g, '').trim();
    }

    // kicker (e.g. Instagram, Facebook) if present inside the item
    let kicker = null;
    const kickerEl = $item.find('.field--name-field-kicker.field__item, .field--name-field-kicker').first();
    if (kickerEl.length) {
      kicker = kickerEl.text().trim() || null;
    }

    // readMore text if present inside the item
    let readMore = '';
    const readMoreEl = $item.find('.read-more, a.read-more, span.read-more').first();
    if (readMoreEl.length) {
      readMore = readMoreEl.text().trim();
    }

    // link - first anchor within the cluster item
    let link = $item.find('a').first().attr('href') || null;
    if (link && !/^https?:\/\//.test(link)) {
      try {
        const urlObj = new URL(baseUrl);
        link = urlObj.origin + link;
      } catch (e) {
        // leave as is
      }
    }

    // image - first img within the item; include alt, width, height
    const $img = $item.find('img').first();
    let imageUrl = $img.attr('src') || null;
    if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
      try {
        const urlObj = new URL(baseUrl);
        imageUrl = urlObj.origin + imageUrl;
      } catch (e) {
        // leave as is
      }
    }
    const imageAlt = $img.attr('alt') || null;
    const imageWidth = $img.attr('width') || null;
    const imageHeight = $img.attr('height') || null;

  const blockObj = { title, readMore, link, image: { src: imageUrl, alt: imageAlt, width: imageWidth, height: imageHeight } };
  if (kicker) blockObj.kicker = kicker;
  blocks.push(blockObj);
  });

  // If we found blocks, push in a single Cluster Block component preserving order
  if (blocks.length) {
    // preserve HTML sequence: headline should appear before blocks in the output object
    let clusterObj;
    if (clusterHeadline) {
      clusterObj = { type: 'Cluster Block', headline: clusterHeadline, blocks };
    } else {
      clusterObj = { type: 'Cluster Block', blocks };
    }
    mainComponents.push(clusterObj);
  }
  return true;
}
