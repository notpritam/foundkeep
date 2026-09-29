// Save preview and Sync status (design system: Components / Save preview,
// Components / Sync status) — what was saved, drawn for the Add details
// card from readCaptureDetails().preview, and whether it has reached the
// library. Shared by review.js and the design system's stories.
import { icon } from './card-icons.js';

const text = value => { const span = document.createElement('span'); span.textContent = value ?? ''; return span.innerHTML; };
export const PREVIEW_KINDS = {
  region: { label: 'Region screenshot', icon: 'screenshot' },
  fullpage: { label: 'Full-page screenshot', icon: 'screenshot' },
  image: { label: 'Image', icon: 'image' },
  post: { label: 'Post on X', icon: 'post' },
  highlight: { label: 'Highlight', icon: 'quote' },
  page: { label: 'Page', icon: 'page' },
};

/** The framed preview, or null for a note (and anything with nothing to show). */
export function renderPreview(preview) {
  const kind = PREVIEW_KINDS[preview?.kind];
  if (!kind) return null;
  const figure = document.createElement('figure');
  figure.className = `fk-preview fk-preview--${preview.kind}`;
  const size = preview.width && preview.height ? ` · ${preview.width}×${preview.height}` : '';
  const label = `<figcaption class="fk-preview__label">${icon(kind.icon, 13)}${text(kind.label)}${text(size)}</figcaption>`;
  if (['region', 'fullpage', 'image'].includes(preview.kind)) {
    if (!preview.image) return null;
    figure.classList.add('fk-preview--media');
    figure.innerHTML = `<img class="fk-preview__image" src="${text(preview.image)}" alt="">${label}`;
  } else if (preview.kind === 'post') {
    figure.innerHTML = `<div class="fk-preview__post"><div class="fk-preview__byline"><span class="fk-preview__avatar">${text((preview.author || '?')[0])}</span><strong>${text(preview.author)}</strong><span>${text(preview.handle)}</span></div><p>${text(preview.text)}</p>${preview.image ? `<img class="fk-preview__image" src="${text(preview.image)}" alt="" referrerpolicy="no-referrer">` : ''}</div>`;
  } else if (preview.kind === 'highlight') {
    figure.innerHTML = `<blockquote class="fk-preview__quote"><p>${text(preview.text)}</p><cite>${text(preview.site)}</cite></blockquote>`;
  } else if (preview.image) {
    figure.classList.add('fk-preview--media');
    figure.innerHTML = `<img class="fk-preview__image" src="${text(preview.image)}" alt="" referrerpolicy="no-referrer">${label}`;
  } else {
    figure.innerHTML = `<div class="fk-preview__page"><span class="fk-preview__site">${icon('page', 13)}${text(preview.site)}</span>${preview.description ? `<p>${text(preview.description)}</p>` : ''}</div>`;
  }
  return figure;
}

export const SYNC_STATES = {
  queued: { icon: 'sync', label: 'Waiting to sync' },
  failed: { icon: 'cloudAlert', label: 'Didn’t sync — click to retry' },
  local: { icon: 'user', label: 'Signed out — click to sign in' },
  synced: { icon: 'check', label: 'In your library' },
};
/** Update (or create) the Sync status icon for a state. Clickable when there is a fix: failed, local. */
export function renderSyncStatus(state, button = document.createElement('button')) {
  const s = SYNC_STATES[state] || SYNC_STATES.queued;
  button.type = 'button';
  button.className = `fk-sync fk-sync--${state} fk-button fk-button--ghost fk-button--sm fk-button--icon` + (button.dataset.overlay === 'true' ? ' fk-sync--overlay' : '');
  button.innerHTML = icon(s.icon, 16);
  button.dataset.tooltip = s.label;
  button.setAttribute('aria-label', s.label);
  button.dataset.state = state;
  return button;
}
