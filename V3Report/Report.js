#!/usr/bin/env node
/**
 * Report.js
 * Crawl all URLs from urls.txt (default) or testurls.txt (if --test) and identify Drupal components
 * based on class tokens derived from catalog YAML.
 * Output: Excel file components_report.xlsx with columns: Page URL, Component Name
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { parse } from 'node-html-parser';

const BASE_DIR = process.cwd();
const CATALOG_PATH = join(BASE_DIR, 'config', 'drupal_component_catalog.yaml');
const URLS_FILE = process.argv.includes('--test') ? 'testurls.txt' : 'urls.txt';
const URLS_PATH = join(BASE_DIR, URLS_FILE);
const OUTPUT_XLSX = join(BASE_DIR, 'components_report.xlsx');
// Path-based soft 404 detection: pages that end up at a not-found style URL but return 200.
// Extend this array with additional regexes if other patterns emerge (e.g., /404, /page-not-found, locale variants).
const NOT_FOUND_PATH_PATTERNS = [/\/not-found(\/|$)/i];
// Additional content-based soft 404 markers (language-independent).
const SOFT_404_BODY_CLASS_PATTERNS = [/\bnot[-_]found\b/i, /\berror[-_]?404\b/i, /\bpage[-_]not[-_]found\b/i];
const SOFT_404_TITLE_PATTERNS = [/\b404\b/];
const SOFT_404_ELEMENT_ID_CLASS_PATTERNS = [/\bnot[-_]found\b/i, /\berror[-_]?404\b/i];

function loadCatalog() {
  const raw = readFileSync(CATALOG_PATH, 'utf-8');
  const data = YAML.parse(raw);
  return data;
}

function humanize(bundle) {
  return bundle.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function classifyMediaComponent(classListStr) {
  if (!classListStr) return 'Media';
  const tokens = classListStr.split(/\s+/);
  // Priority: video first (poster images may coexist)
  if (tokens.includes('media-video-embed')) return 'Media Video';
  if (tokens.includes('media-image')) return 'Media Image';
  return 'Media';
}

function classifyModelViewerComponent(el) {
  // Distinguish 3D vs 2D vs fallback (D Model Viewer)
  // 3D anchors: <model-viewer>, no-poster, no-poster-button, viewer-content-wrap
  // 2D anchors: two-d-model-viewer-sidebar, model-viewer-image, two-d-image, 2d-hotspot-button, 2d-hotspot-description, two-d-hotspot-description
  try {
    if (!el) return 'D Model Viewer';
    const classAttr = el.getAttribute('class') || '';
    const tokens = new Set(classAttr.split(/\s+/).filter(Boolean));
    const is3DDirect = ['no-poster', 'no-poster-button', 'viewer-content-wrap'].some(c => tokens.has(c));
    const is2DDirect = ['two-d-model-viewer-sidebar', 'model-viewer-image', 'two-d-image', '2d-hotspot-button', '2d-hotspot-description', 'two-d-hotspot-description'].some(c => Array.from(tokens).some(t => t === c || t.startsWith(c)));
    // Descendant checks (limited): model-viewer tag or 2D-specific hotspot ids/classes
    const modelViewerTag = el.querySelector && el.querySelector('model-viewer');
    if (modelViewerTag || is3DDirect) return '3D Model Viewer';
    if (is2DDirect) return '2D Model Viewer';
    // Secondary descendant scan (bounded) for 2D markers
    const twoDDescendant = el.querySelector && el.querySelector('[class*="two-d-model-viewer-sidebar"], [class*="2d-hotspot-button"], [id^="2d-hotspot-"]');
    if (twoDDescendant) return '2D Model Viewer';
    return 'D Model Viewer';
  } catch {
    return 'D Model Viewer';
  }
}

function classifyHtmlEditorComponent(el) {
  // Determine subtype of Html Editor content.
  // Priority: Youtube Video > Iframe > Table > File Download Link > HTML Block
  // Returns string component name (e.g., 'HTML Block With Youtube Video').
  try {
    if (!el) return 'HTML Block';
    // Limit subtree queries to necessary tags to reduce cost.
    // YouTube detection
    const iframeNodes = el.querySelectorAll ? el.querySelectorAll('iframe') : [];
    for (const ifr of iframeNodes) {
      const src = (ifr.getAttribute && (ifr.getAttribute('src') || '')) || '';
      if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(src)) {
        return 'HTML Block With Youtube Video';
      }
    }
    // Generic iframe (if any left)
    if (iframeNodes && iframeNodes.length > 0) {
      return 'HTML Block With Iframe';
    }
    // Table
    const table = el.querySelector && el.querySelector('table');
    if (table) return 'HTML Block With Table';
    // File download link pattern.
    // We check anchor tags inside the subtree for file extensions or special classes.
    const downloadExtRe = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt)(?=$|[?#])/i;
    const anchors = el.querySelectorAll ? el.querySelectorAll('a') : [];
    for (const a of anchors) {
      const href = (a.getAttribute && (a.getAttribute('href') || '')) || '';
      const cls = (a.getAttribute && (a.getAttribute('class') || '')) || '';
      if (downloadExtRe.test(href) || /file_download_link|file-download|download-link/i.test(cls)) {
        return 'HTML Block With File Download Link';
      }
    }
    return 'HTML Block';
  } catch {
    return 'HTML Block';
  }
}

function deriveSkeletons(catalog) {
  const sets = catalog.entity_sets;
  const skeletons = [];
  const pushPatterns = (prefix, bundle, priority) => {
    const original = bundle;
    const variations = new Set();
    variations.add(original);
    const noLeading = original.replace(/^_+/, '');
    if (noLeading && noLeading !== original) variations.add(noLeading);
    if (original.startsWith('_')) {
      const internalHyphen = '_' + original.slice(1).replace(/_/g, '-');
      if (internalHyphen !== original) variations.add(internalHyphen);
    }
    const hyphenizedNoLeading = noLeading.replace(/_/g, '-');
    if (hyphenizedNoLeading && hyphenizedNoLeading !== noLeading) variations.add(hyphenizedNoLeading);
    if (!original.startsWith('_')) {
      const hyphenOriginal = original.replace(/_/g, '-');
      if (hyphenOriginal !== original) variations.add(hyphenOriginal);
    }
    const patterns = Array.from(variations).map(v => `^${prefix}${v}($|--)`);
    skeletons.push({
      key: `${prefix.replace(/--$/,'').replace(/-/g,'_')}_${original}`,
      name: humanize(bundle),
      tags: [prefix.split('--')[0]],
      priority,
      classPatterns: patterns.map(p => new RegExp(p))
    });
  };
  for (const p of sets.paragraphs) pushPatterns('paragraph--', p, 50), pushPatterns('paragraph--type--', p, 50);
  for (const n of sets.nodes) pushPatterns('node--', n, 40);
  for (const m of sets.media) pushPatterns('media--', m, 30);
  for (const t of sets.taxonomy_terms) pushPatterns('taxonomy-term--', t, 25);
  return skeletons;
}

function sanitizeUrl(raw) {
  if (!raw) return '';
  let u = raw.replace(/\uFEFF/g, ''); // strip BOM
  u = u.replace(/[\u0000-\u001F\u007F]/g, ''); // control chars
  u = u.trim();
  // remove leading strange replacement chars sometimes copied
  u = u.replace(/^\uFFFD+/, '');
  return u;
}

function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function loadUrls() {
  const raw = readFileSync(URLS_PATH, 'utf-8');
  if (!raw) throw new Error('URLs file blank');
  const urls = [];
  const seen = new Set();
  raw.split(/\r?\n/).forEach(line => {
    const cleaned = sanitizeUrl(line);
    if (!cleaned || cleaned.startsWith('#')) return;
    if (!isValidHttpUrl(cleaned)) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    urls.push(cleaned);
  });
  return urls;
}

async function fetchStaticHtml(url, attempt = 1, chain = []) {
  chain.push(url);
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DrupalComponentScanner/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    // Prioritize Japanese content variants; keep English fallback.
    'Accept-Language': 'ja,ja-JP;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache'
  };
  try {
    const resp = await axios.get(url, { headers: HEADERS, maxRedirects: 0, validateStatus: s => s >= 200 && s < 600, timeout: 20000 });
    // Manual redirect follow (to capture chain & resolve relative locations)
    if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
      let nextUrl;
      try {
        nextUrl = new URL(resp.headers.location, url).href;
      } catch {
        nextUrl = resp.headers.location;
      }
      if (chain.length < 10) {
        return fetchStaticHtml(nextUrl, attempt + 1, chain);
      } else {
        console.warn('Redirect chain exceeded limit (10), stopping at', nextUrl);
      }
    }
    return { status: resp.status, html: typeof resp.data === 'string' ? resp.data : '', finalUrl: url, chain };
  } catch (e) {
    if (attempt < 3) {
      const delay = 500 * attempt;
      console.warn(`Retry ${attempt} for ${url} after error: ${e.message}`);
      await new Promise(r => setTimeout(r, delay));
      return fetchStaticHtml(url, attempt + 1, chain);
    }
    console.error('Failed to fetch', url, e.message);
    return { status: 0, html: '', finalUrl: url, chain };
  }
}

function shouldSkipElement(el) {
  // Skip head tag and anything under header or footer semantic sections
  const skipTags = new Set(['HEAD', 'HEADER', 'FOOTER']);
  if (skipTags.has((el.tagName || '').toUpperCase())) return true;
  // ascend parents
  let p = el.parentNode;
  while (p) {
    const tag = (p.tagName || '').toUpperCase();
    if (skipTags.has(tag)) return true;
    p = p.parentNode;
  }
  return false;
}

function extractClassTokens(html) {
  const root = parse(html);
  const tokens = new Set();
  root.querySelectorAll('*').forEach(el => {
    if (shouldSkipElement(el)) return;
    const cls = el.getAttribute('class');
    if (!cls) return;
    cls.split(/\s+/).forEach(token => {
      if (!token) return;
      if (token.startsWith('paragraph--') || token.startsWith('node--') || token.startsWith('media--') || token.startsWith('taxonomy-term--')) {
        tokens.add(token);
      }
    });
  });
  return Array.from(tokens);
}

function matchComponents(classTokens, skeletons) {
  const matches = [];
  const skeletonRegExGroups = skeletons.map(sk => ({ sk, patterns: sk.classPatterns }));
  for (const token of classTokens) {
    for (const { sk, patterns } of skeletonRegExGroups) {
      for (const re of patterns) {
        if (re.test(token)) {
          matches.push({ component: sk.name, rawClass: token });
          break;
        }
      }
    }
  }
  return matches;
}

async function main() {
  const catalog = loadCatalog();
  const skeletons = deriveSkeletons(catalog);
  // (Removed temporary debug logging for _d-model_viewer patterns)
  const urls = loadUrls();
  console.log(`Loaded ${urls.length} URLs, ${skeletons.length} detection skeletons.`);
  // Static fetch mode (no headless browser). If dynamic JS components are needed later, we can add an optional flag.

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Components');
  sheet.columns = [
    { header: 'Page URL', key: 'page_url', width: 120 },
    { header: 'Component Name', key: 'component_name', width: 40 }
  ];
  // Metrics sheet for diagnostics
  const metricsSheet = workbook.addWorksheet('Metrics');
  metricsSheet.columns = [
    { header: 'Page URL (Requested)', key: 'page_url', width: 60 },
    { header: 'Final URL', key: 'final_url', width: 60 },
    { header: 'Status Code', key: 'status_code', width: 12 },
    { header: 'Classification', key: 'classification', width: 18 },
    { header: 'Redirects', key: 'redirects', width: 12 },
    { header: 'Elements Scanned', key: 'elements_scanned', width: 18 },
    { header: 'Tokens Collected', key: 'tokens_collected', width: 18 },
    { header: 'Matches Found', key: 'matches_found', width: 18 }
  ];

  const diagnostics = []; // collect per-URL fetch diagnostics

  const unmatchedGlobal = new Map(); // token -> count

  for (const url of urls) {
    console.log('Processing', url);
    let attempt = 0;
    let finalAttemptMetrics = null;
    while (attempt < 3) {
      attempt += 1;
      const { status, html, finalUrl, chain } = await fetchStaticHtml(url);
      console.log(`Attempt ${attempt}: Status code: ${status} (final URL: ${finalUrl})`);
      const redirects = chain.length > 0 ? chain.length - 1 : 0;
      let classification = 'ok';
      let soft404Reason = '';
      let disclaimerBypassed = false;
      let disclaimerEncountered = false; // track presence of disclaimer for retry logic

      // 1. Status code based
      if (status === 404) {
        classification = '404';
        soft404Reason = 'http-status';
      }

      // 2. Path based
      if (classification === 'ok') {
        try {
          const finalPath = new URL(finalUrl).pathname;
          if (NOT_FOUND_PATH_PATTERNS.some(re => re.test(finalPath))) {
            classification = 'soft404';
            soft404Reason = 'path-pattern';
          }
        } catch { /* ignore */ }
      }

      // 3. Empty body
      if (classification === 'ok' && !html) {
        classification = 'empty';
        soft404Reason = 'empty-html';
      }

      // 4. Content marker based (parse only if still not classified as not found & have html)
      let softRoot;
      if (html) {
        softRoot = parse(html);
        if (classification === 'ok') {
          try {
            const body = softRoot.querySelector('body');
            const titleEl = softRoot.querySelector('title');
            const bodyClass = body ? (body.getAttribute('class') || '') : '';
            const titleText = titleEl ? titleEl.text.trim() : '';
            if (bodyClass && SOFT_404_BODY_CLASS_PATTERNS.some(re => re.test(bodyClass))) {
              classification = 'soft404-content';
              soft404Reason = 'body-class';
            }
            if (classification === 'ok' && titleText && SOFT_404_TITLE_PATTERNS.some(re => re.test(titleText))) {
              classification = 'soft404-content';
              soft404Reason = 'title';
            }
            if (classification === 'ok') {
              const candidateEls = softRoot.querySelectorAll('[id], [class]');
              for (const el of candidateEls.slice(0, 500)) {
                const id = el.getAttribute('id') || '';
                const cls = el.getAttribute('class') || '';
                if (SOFT_404_ELEMENT_ID_CLASS_PATTERNS.some(re => re.test(id)) || SOFT_404_ELEMENT_ID_CLASS_PATTERNS.some(re => re.test(cls))) {
                  classification = 'soft404-content';
                  soft404Reason = id ? 'element-id' : 'element-class';
                  break;
                }
              }
            }
          } catch (e) {
            console.warn('Soft 404 content pattern evaluation error:', e.message);
          }
        }
      }

      // Record diagnostics only on the final chosen attempt; buffer for now.
      // Early exits for 404/soft404/no html (no retry logic needed regardless of disclaimer presence)
      if (classification.startsWith('soft404') || classification === '404') {
        if (classification !== '404') {
          console.log(`Classified as ${classification} (${soft404Reason}). Skipping traversal.`);
        }
        sheet.addRow({ page_url: url, component_name: '404' });
        metricsSheet.addRow({ page_url: url, final_url: finalUrl, status_code: status, classification, redirects, elements_scanned: 0, tokens_collected: 0, matches_found: 0 });
        diagnostics.push({ requested_url: url, final_url: finalUrl, status_code: status, redirects, chain, classification, reason: soft404Reason });
        break; // move to next URL
      }
      if (!html) {
        metricsSheet.addRow({ page_url: url, final_url: finalUrl, status_code: status, classification, redirects, elements_scanned: 0, tokens_collected: 0, matches_found: 0 });
        diagnostics.push({ requested_url: url, final_url: finalUrl, status_code: status, redirects, chain, classification, reason: soft404Reason });
        break;
      }

      // Parse DOM and attempt disclaimer bypass
      let root = parse(html);
      try {
        const disclaimerEl = root.querySelector('.one-step-disclaimer-agree, .paragraph--type--one_step_disclaimer');
        if (disclaimerEl) {
          disclaimerEncountered = true;
          const anchor = disclaimerEl.querySelector('a[href*="token="]');
          if (anchor) {
            const href = anchor.getAttribute('href');
            if (href) {
              try {
                const resolved = new URL(href, finalUrl).href;
                if (resolved !== finalUrl) {
                  console.log('One Step Disclaimer detected. Following token URL:', resolved);
                  const fetched = await fetchStaticHtml(resolved);
                  if (fetched && fetched.html && fetched.status >= 200 && fetched.status < 400) {
                    root = parse(fetched.html);
                    disclaimerBypassed = true;
                  } else {
                    console.log('Token fetch failed or returned non-success status, keep original HTML.');
                  }
                }
              } catch (e) {
                console.warn('Disclaimer bypass resolution error:', e.message);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Disclaimer bypass evaluation error:', e.message);
      }

      // Traverse DOM collecting components (buffer rows until decision to finalize)
      let elementsScanned = 0;
      const tokensCollected = new Set();
      const componentRows = [];
      root.querySelectorAll('*').forEach(el => {
        elementsScanned += 1;
        if (shouldSkipElement(el)) return;
        const cls = el.getAttribute('class');
        if (!cls) return;
        const perElementTokens = [];
        cls.split(/\s+/).forEach(token => {
          if (!token) return;
          if (token.startsWith('paragraph--') || token.startsWith('node--') || token.startsWith('media--') || token.startsWith('taxonomy-term--')) {
            tokensCollected.add(token);
            perElementTokens.push(token);
          }
        });
        if (!perElementTokens.length) return;
        for (const token of perElementTokens) {
          for (const { sk, patterns } of skeletons.map(sk => ({ sk, patterns: sk.classPatterns }))) {
            let matched = false;
            for (const re of patterns) { if (re.test(token)) { matched = true; break; } }
            if (matched) {
              let compName = sk.name;
              if (compName === 'Media') {
                compName = classifyMediaComponent(cls);
              } else if (compName === 'D Model Viewer') {
                compName = classifyModelViewerComponent(el);
              } else if (compName === 'Html Editor' || compName === 'Html Editor Fact Box' || compName === 'Html Editor Fact Box'.toLowerCase()) {
                if (compName === 'Html Editor') compName = classifyHtmlEditorComponent(el);
              }
              if (disclaimerBypassed && compName === 'One Step Disclaimer') return; // skip reporting disclaimer after bypass
              componentRows.push({ page_url: url, component_name: compName });
            }
          }
        }
      });
      const matchesFound = componentRows.length;

      // Decision: retry only if disclaimer encountered AND components < 2
      if (disclaimerEncountered && matchesFound < 2 && attempt < 3) {
        console.log(`Disclaimer encountered and only ${matchesFound} component(s) detected (<2). Retrying (attempt ${attempt + 1} of 3)...`);
        await new Promise(r => setTimeout(r, 400 * attempt));
        continue; // next attempt
      }

      // Finalize: flush component rows and unmatched tokens
      componentRows.forEach(r => sheet.addRow(r));
      tokensCollected.forEach(t => {
        let hit = false;
        for (const sk of skeletons) { if (sk.classPatterns.some(re => re.test(t))) { hit = true; break; } }
        if (!hit) unmatchedGlobal.set(t, (unmatchedGlobal.get(t) || 0) + 1);
      });
      const finalClassification = disclaimerBypassed ? (classification + '|disclaimer-bypassed') : classification;
      metricsSheet.addRow({ page_url: url, final_url: finalUrl, status_code: status, classification: finalClassification, redirects, elements_scanned: elementsScanned, tokens_collected: tokensCollected.size, matches_found: matchesFound });
      diagnostics.push({ requested_url: url, final_url: finalUrl, status_code: status, redirects, chain, classification: finalClassification, reason: soft404Reason, disclaimer_attempts: attempt, disclaimer_encountered: disclaimerEncountered, disclaimer_bypassed: disclaimerBypassed });
      break; // finished processing this URL
    }
  }

  await workbook.xlsx.writeFile(OUTPUT_XLSX);
  console.log('Report written to', OUTPUT_XLSX);

  // Write unmatched class tokens for analysis
  const unmatchedPath = join(BASE_DIR, 'unmatched_class_tokens.csv');
  let unmatchedCsv = 'class_token,count\n';
  for (const [token, count] of unmatchedGlobal.entries()) {
    unmatchedCsv += `${token},${count}\n`;
  }
  writeFileSync(unmatchedPath, unmatchedCsv, 'utf-8');
  console.log('Unmatched class tokens written to', unmatchedPath);
  console.log('Report written to', OUTPUT_XLSX);

  // Write diagnostics JSON
  const diagPath = join(BASE_DIR, 'fetch_diagnostics.json');
  writeFileSync(diagPath, JSON.stringify(diagnostics, null, 2), 'utf-8');
  console.log('Fetch diagnostics written to', diagPath);
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});
