export function getComponentTypeClass($, element) {
  // Prefer the element's own paragraph--type-- class (handles wrapper paragraphs)
  const selfCls = ($(element).attr('class') || '').replace(/\s+/g, ' ').trim();
  if (selfCls) {
    const selfParts = selfCls.split(/\s+/);
    const selfSub = selfParts.find(p => p.indexOf('paragraph--type--') === 0);
    if (selfSub) return selfSub.substring('paragraph--type--'.length) || '';
  }

  // Next try: an immediate child paragraph node (common wrapper pattern)
  const childParagraph = $(element).children().filter('[class*="paragraph--type--"]').first();
  if (childParagraph && childParagraph.length) {
    const cls = (childParagraph.attr('class') || '').replace(/\s+/g, ' ').trim();
    const parts = cls.split(/\s+/);
    const subcomponent = parts.find(p => p.indexOf('paragraph--type--') === 0);
    if (subcomponent) return subcomponent.substring('paragraph--type--'.length) || '';
  }

  // fallback: look for any descendant that has a class starting with paragraph--type--
  const descendant = $(element).find('[class*="paragraph--type--"]').first();
  if (!descendant || !descendant.length) {
    return '';
  }
  const cls = (descendant.attr('class') || '').replace(/\s+/g, ' ').trim();
  const parts = cls.split(/\s+/);
  const subcomponent = parts.find(p => p.indexOf('paragraph--type--') === 0);
  if (!subcomponent) return '';
  return subcomponent.substring('paragraph--type--'.length) || '';
}

export function isComponentType($, fieldItem, type) {
  // check anywhere inside the fieldItem for the paragraph type
  return $(fieldItem).find(`.paragraph--type--${type}`).length > 0;
}

export function normalizeUrl(maybeUrl, base) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//.test(maybeUrl)) return maybeUrl;
  try {
    const urlObj = new URL(maybeUrl, base);
    return urlObj.href;
  } catch (e) {
    return maybeUrl; // leave as-is on errors
  }
}

export function extractImageMetadata(imgEl, base) {
  if (!imgEl || !imgEl.length) return null;
  const src = (imgEl.attr('src') || imgEl.attr('data-src') || '').trim() || null;
  const alt = (imgEl.attr('alt') || '').trim() || null;
  const width = (imgEl.attr('width') || imgEl.attr('data-width') || '').trim() || null;
  const height = (imgEl.attr('height') || imgEl.attr('data-height') || '').trim() || null;
  return {
    src: src ? normalizeUrl(src, base) : null,
    alt,
    width: width || null,
    height: height || null
  };
}

export function extractPageMetadata($, pageUrl) {
  const title = $('title').first().text().trim() || null;
  const meta = {};
  $('meta').each((i, el) => {
    const name = $(el).attr('name');
    const prop = $(el).attr('property');
    const itemprop = $(el).attr('itemprop');
    const content = $(el).attr('content') || $(el).attr('value') || null;
    const key = name || prop || itemprop;
    if (key && content) {
      meta[key] = content;
    }
  });
  // canonical link
  const canonical = $('link[rel="canonical"]').attr('href');
  if (canonical) meta.canonical = canonical;

  return { title, url: pageUrl, meta };
}
