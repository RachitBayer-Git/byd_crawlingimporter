import { normalizeUrl } from '../utils/index.js';

export default function processCtaButton($, fieldItem, mainComponents, baseUrl) {
  const isSelf = $(fieldItem).is('.paragraph--type--cta-button');
  const isDesc = $(fieldItem).find('.paragraph--type--cta-button').length > 0;
  if (!isSelf && !isDesc) return false;

  const root = isSelf ? $(fieldItem) : $(fieldItem).find('.paragraph--type--cta-button').first();

  // The CTA markup is typically a .field--name-field-cta containing an <a>
  const a = root.find('.field--name-field-cta a').first();
  if (!a || !a.length) return false;

  const text = a.text().trim() || null;
  const href = a.attr('href') || null;
  const url = href ? normalizeUrl(href, baseUrl) : null;

  // capture modifier classes from paragraph element (e.g., arrow, blue/green, left/right)
  const cls = (root.attr('class') || '').replace(/\s+/g, ' ').trim();
  const parts = cls.split(/\s+/);
  const style = {};
  // color (blue/green/etc)
  const color = parts.find(p => /^(blue|green|red|orange|yellow|grey|black)$/.test(p));
  if (color) style.color = color;
  // arrow presence and direction
  if (parts.includes('arrow')) style.arrow = true;
  if (parts.includes('left')) style.align = 'left';
  if (parts.includes('right')) style.align = 'right';

  const obj = { type: 'CTA Button' };
  if (text) obj.text = text;
  if (url) obj.url = url;
  if (Object.keys(style).length) obj.style = style;

  mainComponents.push(obj);
  return true;
}

