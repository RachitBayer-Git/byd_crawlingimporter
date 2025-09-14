import fs from 'fs';
import path from 'path';

// Remove leading/trailing control chars, BOM, zero-width, non-breaking space
function sanitizeLine(line) {
  if (!line) return '';
  return line
    // strip BOM or zero-width and control chars at start
    .replace(/^[\uFEFF\u200B\u200C\u200D\u202A-\u202E\u2060\u0000-\u001F\u00A0]+/, '')
    // strip trailing control chars
    .replace(/[\u0000-\u001F]+$/, '')
    .trim();
}

function decodeBuffer(buf) {
  if (buf.length >= 2) {
    // UTF-16 LE BOM FF FE
    if (buf[0] === 0xFF && buf[1] === 0xFE) {
      const content = buf.slice(2);
      return content.toString('utf16le');
    }
    // UTF-16 BE BOM FE FF
    if (buf[0] === 0xFE && buf[1] === 0xFF) {
      const content = buf.slice(2);
      // swap bytes for LE decode
      const swapped = Buffer.allocUnsafe(content.length);
      for (let i = 0; i < content.length; i += 2) {
        swapped[i] = content[i+1];
        swapped[i+1] = content[i];
      }
      return swapped.toString('utf16le');
    }
  }
  // default assume UTF-8 (Node handles UTF-8 BOM automatically when using toString())
  return buf.toString('utf8');
}

export function loadUrls(filePath, { allowComments = true, normalize = true, warn = true } = {}) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    if (warn) console.warn('URL file not found:', abs);
    return [];
  }
  const buf = fs.readFileSync(abs);
  const rawText = decodeBuffer(buf);
  const lines = rawText.split(/\r?\n/);
  const urls = [];
  for (let original of lines) {
    let line = sanitizeLine(original);
    if (!line) continue;
    if (allowComments && line.startsWith('#')) continue;
    // remove accidental leading punctuation before scheme
    line = line.replace(/^[^hH]+(https?:\/\/)/, '$1');
    if (!/^https?:\/\//i.test(line)) {
      if (warn) console.warn('Skipping invalid URL line:', JSON.stringify(original));
      continue;
    }
    if (normalize) {
      try {
        const u = new URL(line);
        let pathname = u.pathname;
        if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
        line = u.origin + pathname + (u.search || '');
      } catch (e) {
        if (warn) console.warn('Normalization failed for', line, e.message);
      }
    }
    urls.push(line);
  }
  return Array.from(new Set(urls)); // dedupe preserving order
}
