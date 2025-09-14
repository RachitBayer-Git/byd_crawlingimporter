import { normalizeUrl, extractImageMetadata } from '../utils/index.js';

export default function processJobSearchBanner($, fieldItem, mainComponents, baseUrl) {
  // match when paragraph type is job-search-banner either on self or descendant
  const isSelf = $(fieldItem).is('.paragraph--type--job-search-banner');
  const isDesc = $(fieldItem).find('.paragraph--type--job-search-banner').length > 0;
  if (!isSelf && !isDesc) return false;

  const root = isSelf ? $(fieldItem) : $(fieldItem).find('.paragraph--type--job-search-banner').first();

  // image (include metadata: src, alt, width, height)
  const imgEl = root.find('.field--name-image img').first();
  let image = null;
  if (imgEl && imgEl.length) {
    image = extractImageMetadata(imgEl, baseUrl);
  }

  const kicker = root.find('.field--name-field-kicker').first().text().trim() || null;
  const title = root.find('.field--name-field-title').first().text().trim() || null;

  // form
  const formEl = root.find('form.job-search-form').first();
  const form = {};
  if (formEl && formEl.length) {
    form.action = formEl.attr('action') || null;
    form.id = formEl.attr('id') || null;
    form.inputs = [];
    formEl.find('input').each((i, inp) => {
      const $inp = $(inp);
      form.inputs.push({
        name: $inp.attr('name') || null,
        id: $inp.attr('id') || null,
        placeholder: $inp.attr('placeholder') || null,
        value: $inp.attr('value') || ''
      });
    });
  }

  // career links (re-use existing markup: career-link paragraphs)
  const careerLinks = [];
  root.find('.paragraph--type--career-link').each((i, el) => {
    const $el = $(el);
    const sectionTitle = $el.find('.field--name-field-title').first().text().trim() || null;
    const links = [];
    $el.find('a').each((j, a) => {
      links.push({ text: $(a).text().trim(), url: $(a).attr('href') || null });
    });
    careerLinks.push({ title: sectionTitle, links });
  });

  const obj = { type: 'Job Search Banner' };
  if (kicker) obj.kicker = kicker;
  if (title) obj.title = title;
  if (image) obj.image = image;
  if (Object.keys(form).length) obj.form = form;
  if (careerLinks.length) obj.careerLinks = careerLinks;

  mainComponents.push(obj);
  return true;
}
