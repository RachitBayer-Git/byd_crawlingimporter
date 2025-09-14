import { normalizeUrl } from '../utils/index.js';

export default function processSitemap($, fieldItem, mainComponents, baseUrl) {
  const isSelf = $(fieldItem).is('.paragraph--type--sitemap');
  const isDesc = $(fieldItem).find('.paragraph--type--sitemap').length > 0;
  if (!isSelf && !isDesc) return false;

  const root = isSelf ? $(fieldItem) : $(fieldItem).find('.paragraph--type--sitemap').first();

    const sections = [];

  // helper: parse a <ul> into an array of link objects preserving nested lists
  function parseList($ul) {
    const out = [];
    $ul.children('li').each((i, li) => {
      const $li = $(li);
      const $a = $li.children('a').first();
      const text = $a && $a.length ? ($a.text().trim() || null) : null;
      const href = $a && $a.length ? ($a.attr('href') || null) : null;
      const url = href ? normalizeUrl(href, baseUrl) : null;

      const item = {};
      if (text) item.text = text;
      if (url) item.url = url;

      const $childUl = $li.children('ul').first();
      if ($childUl && $childUl.length) {
        const children = parseList($childUl);
        if (children.length) item.children = children;
      }

      out.push(item);
    });
    return out;
  }

  // Top-level entries are usually direct children of ul.site-map
  root.find('ul.site-map > li').each((i, li) => {
    const $li = $(li);
    const topA = $li.children('a').first();
    const title = topA && topA.length ? (topA.text().trim() || null) : null;
    const href = topA && topA.length ? (topA.attr('href') || null) : null;
    const url = href ? normalizeUrl(href, baseUrl) : null;

    // If there is a nested <ul>, parse it preserving hierarchy
    const $nested = $li.children('ul').first();
    let links = [];
    if ($nested && $nested.length) {
      links = parseList($nested);
    } else {
      // no nested list: collect direct child anchors (if any)
      const a = $li.children('a').first();
      if (a && a.length) {
        const text = a.text().trim() || null;
        const h = a.attr('href') || null;
        const u = h ? normalizeUrl(h, baseUrl) : null;
        links.push({ text, url: u });
      }
    }

    sections.push({ title, url, links });
  });

  // fallback: if structure differs, collect all links under the sitemap paragraph
  if (sections.length === 0) {
    const allLinks = [];
    root.find('a').each((i, a) => {
      const $a = $(a);
      const text = $a.text().trim() || null;
      const h = $a.attr('href') || null;
      const u = h ? normalizeUrl(h, baseUrl) : null;
      allLinks.push({ text, url: u });
    });
    if (allLinks.length) {
      mainComponents.push({ type: 'Sitemap', sections: [{ title: null, url: null, links: allLinks }] });
      return true;
    }
  }

  mainComponents.push({ type: 'Sitemap', sections });
  return true;
}
