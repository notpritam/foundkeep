// The extension's "Add details" card, built from its own source: the form is
// cloned from review.html, the tag controls are rendered by the real
// bindSaveTags() (save-details.js), and states are applied the way review.js
// applies them. Single controls are cut from the same clone, so a change to
// review.html shows up here without touching a story.
import reviewHtml from '../../apps/extension/src/review.html?raw';
import { bindSaveTags } from '../../apps/extension/src/save-details.js';

const template = new DOMParser().parseFromString(reviewHtml, 'text/html').querySelector('#detailsForm');

export const TITLE = 'The half-life of a good idea — The Margin';
export const NOTE = 'Worth rereading before the Q4 planning doc: the part about spacing reviews.';
export const FOLDERS = ['Reading list', 'Research'];
export const COLLECTIONS = [{ title: 'Design that works', visibility: 'public', requireApproval: true }];

const option = (value, label = value) => Object.assign(document.createElement('option'), { value, textContent: label });
const tone = (el, text, value = '') => { el.textContent = text; el.dataset.tone = value; };

/**
 * The whole card, 380px wide like the framed card.
 * state: 'prefilled' | 'empty' | 'new-folder' | 'sharing' | 'loading' | 'error'
 */
export function card({ state = 'prefilled', tags = ['Memory'], title = TITLE, note = NOTE, fullHeight = true } = {}) {
  const form = template.cloneNode(true);
  const $ = id => form.querySelector('#' + id);
  const empty = state === 'empty';
  form.dataset.ready = String(state !== 'loading');
  $('detailsEyebrow').textContent = 'Saved to My library';
  $('detailsHeading').textContent = empty ? 'Your save' : title;
  $('detailsTitle').value = empty ? '' : title;
  $('detailsNote').value = empty ? '' : note;
  $('detailsFolder').replaceChildren(option('', 'No folder'), ...FOLDERS.map(name => option(name)));
  $('detailsCollection').replaceChildren(option('', 'Don’t share'), ...COLLECTIONS.map(c => option(c.title)));
  bindSaveTags($('detailsTags'), () => {}).set(empty ? [] : tags);
  $('detailsFields').disabled = state === 'loading';
  $('detailsSave').disabled = state === 'loading' || state === 'error' || empty;
  if (state === 'new-folder') {
    $('detailsNewFolder').hidden = false;
    $('detailsNewFolderToggle').setAttribute('aria-expanded', 'true');
    $('detailsFolderName').value = 'Essays';
  }
  if (state === 'sharing') {
    const collection = COLLECTIONS[0];
    $('detailsCollection').value = collection.title;
    $('detailsShare').hidden = false;
    $('shareImageLabel').hidden = false;
    $('sharedTitle').value = title;
    $('sharedUrl').value = 'https://themargin.example/half-life-of-a-good-idea';
    $('sharedBody').value = 'Most of what we read is gone within a week. A small practice of keeping changes what stays.';
    bindSaveTags($('sharedTags'), () => {}).set(['Learning']);
    $('detailsRules').textContent = 'Public collection: anyone can read approved entries. Your submission needs approval.';
    $('detailsSave').textContent = 'Save and submit for approval';
  }
  if (state === 'loading') tone($('detailsFeedback'), 'Loading folders and collections…');
  if (state === 'error') {
    tone($('detailsFeedback'), 'Some folders or collections could not load. Retry, or save without them.', 'error');
    $('detailsReload').hidden = false;
  }
  // The extension frames the card at most 600px tall and scrolls its fields;
  // here it shows whole unless fullHeight is off.
  form.style.maxHeight = fullHeight ? 'none' : '600px';
  const frame = document.createElement('div');
  frame.style.cssText = 'width:380px;max-width:100%';
  frame.append(form);
  return frame;
}

// --- Single controls, cut from a clone of the same form ----------------------
// Ids are dropped so a docs page can hold many copies; review.css rules keyed
// to ids are kept by wrapping the control in the ids' context.
function strip(node) { node.removeAttribute?.('id'); node.querySelectorAll?.('[id]').forEach(el => el.removeAttribute('id')); node.querySelectorAll?.('[for]').forEach(el => el.removeAttribute('for')); return node; }
/** Wrap controls as they sit in the card body (review.css keys off #detailsContent). */
export function inBody(...nodes) {
  const body = document.createElement('fieldset'); body.className = 'review-body'; body.style.cssText = 'padding:0;overflow:visible';
  const content = document.createElement('div'); content.id = 'detailsContent'; content.append(...nodes);
  body.append(content); return body;
}
const labelOf = input => input.closest('label');

export function textField({ label = 'Title', value = TITLE, placeholder = 'Give this save a useful name', disabled = false } = {}) {
  const field = labelOf(template.querySelector('#detailsTitle')).cloneNode(true); strip(field);
  field.firstChild.textContent = label;
  const input = field.querySelector('input'); input.placeholder = placeholder; input.value = value; input.disabled = disabled;
  return inBody(field);
}
export function textArea({ label = 'Personal note', value = NOTE, placeholder = 'Why are you saving this?', rows = 3, disabled = false } = {}) {
  const field = labelOf(template.querySelector('#detailsNote')).cloneNode(true); strip(field);
  field.querySelector('span').textContent = label;
  const area = field.querySelector('textarea'); area.placeholder = placeholder; area.value = value; area.rows = rows; area.disabled = disabled;
  return inBody(field);
}
export function dropdown({ kind = 'folder', value = '', disabled = false, unavailable = false } = {}) {
  if (kind === 'collection') {
    const field = labelOf(template.querySelector('#detailsCollection')).cloneNode(true); strip(field);
    const select = field.querySelector('select');
    select.replaceChildren(option('', 'Don’t share'), ...COLLECTIONS.map(c => option(c.title)));
    select.value = value; select.disabled = disabled;
    return inBody(field);
  }
  const field = labelOf(template.querySelector('#detailsFolder')).cloneNode(true); strip(field);
  const select = field.querySelector('select');
  select.replaceChildren(...(unavailable ? [option('gone', 'Unavailable folder — choose another')] : []), option('', 'No folder'), ...FOLDERS.map(name => option(name)));
  select.value = unavailable ? 'gone' : value; select.disabled = disabled;
  return inBody(field);
}
export function folderRow({ newFolder = false, status = '' } = {}) {
  const head = strip(template.querySelector('.destination-folder-head').cloneNode(true));
  head.querySelector('button').setAttribute('aria-expanded', String(newFolder));
  const select = dropdown().querySelector('label');
  const nodes = [head, select];
  if (newFolder) {
    const form = template.querySelector('#detailsNewFolder').cloneNode(true); strip(form);
    form.hidden = false; form.id = 'detailsNewFolder'; // review.css styles it by id
    form.querySelector('input').value = 'Essays';
    tone(form.querySelector('.statusline'), status);
    nodes.push(form);
  }
  return inBody(...nodes);
}
export function button({ kind = 'primary', label = 'Save details', disabled = false } = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = `btn ${kind}`; b.textContent = label; b.disabled = disabled;
  return b;
}
export function actionBar({ state = 'ready', saveLabel = 'Save details' } = {}) {
  const foot = strip(template.querySelector('.review-foot').cloneNode(true));
  const [feedback] = foot.querySelectorAll('.statusline');
  const [reload, cancel, save] = foot.querySelectorAll('button');
  save.textContent = saveLabel;
  save.disabled = state !== 'ready';
  if (state === 'error') { tone(feedback, 'Some folders or collections could not load. Retry, or save without them.', 'error'); reload.hidden = false; }
  if (state === 'saving') { tone(feedback, 'Saving…'); cancel.disabled = true; save.textContent = 'Saving…'; }
  const frame = document.createElement('div'); frame.style.cssText = 'width:380px;max-width:100%'; frame.append(foot);
  return frame;
}
export function tagChip({ name = 'Read later', chosen = false } = {}) {
  const chip = document.createElement('button'); chip.type = 'button';
  chip.className = 'save-tag-chip' + (chosen ? ' selected' : '');
  chip.textContent = chosen ? `${name} ×` : `+ ${name}`;
  chip.setAttribute('aria-label', (chosen ? 'Remove tag ' : 'Add tag ') + name);
  return chip;
}
/** The live tag control: bindSaveTags() renders it and handles typing, Enter, chips and errors. */
export function tagEntry({ legend = 'Personal tags', tags = [], typed = '', error = false } = {}) {
  const field = strip(template.querySelector('#detailsTags').closest('fieldset').cloneNode(true));
  field.querySelector('legend').textContent = legend;
  const control = bindSaveTags(field.querySelector('div'), () => {});
  control.set(tags, typed);
  if (typed) field.querySelector('input').dispatchEvent(new Event('input'));
  if (error) control.flush(); // runs the real validation, which shows its own message
  return inBody(field);
}
export function checkbox({ label = 'Include the saved image', checked = false, disabled = false } = {}) {
  const field = strip(template.querySelector('#shareImageLabel').cloneNode(true));
  field.hidden = false; field.lastChild.textContent = label;
  const box = field.querySelector('input'); box.checked = checked; box.disabled = disabled;
  return inBody(field);
}
export function disclosure({ open = false, excerpt = 'In 1885 Hermann Ebbinghaus sat alone in a room memorising nonsense syllables and testing himself at intervals. What he found has been rediscovered by every student since.' } = {}) {
  const details = template.querySelector('#detailsOriginal').cloneNode(true); // review.css styles it by id
  details.hidden = false; details.open = open;
  details.querySelector('#detailsExcerpt').textContent = excerpt;
  return inBody(details);
}
