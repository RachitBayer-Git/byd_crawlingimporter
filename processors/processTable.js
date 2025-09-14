import { normalizeUrl } from '../utils/index.js';

export default function processTable($, fieldItem, mainComponents, baseUrl) {
  const isSelf = $(fieldItem).is('.paragraph--type--table');
  const isDesc = $(fieldItem).find('.paragraph--type--table').length > 0;
  if (!isSelf && !isDesc) return false;

  const root = isSelf ? $(fieldItem) : $(fieldItem).find('.paragraph--type--table').first();

  // optional title
  const titleEl = root.find('.paragraph--type--title').first();
  const title = titleEl && titleEl.length ? titleEl.text().trim() || null : null;

  const table = root.find('table').first();
  if (!table || !table.length) return false;

  // helper to extract cell content (preserve html and text)
  function extractCell($cell) {
    // if cell contains nested paragraph content (e.g., paragraph--type--text), extract its inner html
    const innerParagraph = $cell.find('.paragraph--type--text, .paragraph--type--text-with-image').first();
    if (innerParagraph && innerParagraph.length) {
      const rich = innerParagraph.find('.field--name-field-text-content, .field--name-field-introduction').first();
      const html = rich && rich.length ? rich.html() : innerParagraph.html();
      const text = rich && rich.length ? rich.text().trim() : innerParagraph.text().trim();
      return { html: html || null, text: text || null };
    }

    // otherwise capture cell html and text
    const html = $cell.html() || null;
    const text = $cell.text() ? $cell.text().trim() : null;
    // normalize any anchors found inside cell
    const links = [];
    $cell.find('a').each((i, a) => {
      const $a = $(a);
      const h = $a.attr('href') || null;
      if (h) links.push({ text: $a.text().trim() || null, url: normalizeUrl(h, baseUrl) });
    });
    const out = { html: html || null, text: text || null };
    if (links.length) out.links = links;
    return out;
  }

  // parse headers if present
  const headers = [];
  const thead = table.find('thead').first();
  if (thead && thead.length) {
    thead.find('th').each((i, th) => headers.push($(th).text().trim() || null));
  } else {
    // try first row as header if contains th
    const firstRowTh = table.find('tr').first().find('th');
    if (firstRowTh && firstRowTh.length) {
      firstRowTh.each((i, th) => headers.push($(th).text().trim() || null));
    }
  }

  const rows = [];
  table.find('tbody > tr, tr').each((ri, tr) => {
    const $tr = $(tr);
    // skip rows that are inside nested table-items wrapper divs used in CMS markup
    if ($tr.parents('.paragraph--type--table-items').length === 0 && $tr.closest('table').get(0) !== table.get(0)) return;
    const cols = [];
    $tr.find('th, td').each((ci, cell) => {
      const $cell = $(cell);
      cols.push(extractCell($cell));
    });
    // only push non-empty rows
    if (cols.length) rows.push(cols);
  });

  const html = table.html() ? `<table>${table.html()}</table>` : null;

  const obj = { type: 'Table' };
  if (title) obj.title = title;
  if (headers && headers.length) obj.headers = headers;
  if (rows && rows.length) obj.rows = rows;
  if (html) obj.html = html;

  mainComponents.push(obj);
  return true;
}
