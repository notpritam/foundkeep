// Shared rules for the details card (review.html) and its trusted background edit (capture-details.js).
export const STARTER_TAGS = ['Read later', 'Inspiration', 'Work', 'Personal'];
export function normalizeSaveTags(values, maxTags = 20) {
  if (!Array.isArray(values) || values.length > maxTags) throw new Error(`Choose up to ${maxTags} tags.`);
  const tags = new Map();
  for (const value of values) {
    if (typeof value !== 'string') throw new Error('Tags must be text.');
    const name = value.trim().replace(/^#/, '').trim().normalize('NFC');
    if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Use 1–40 characters per tag, without line breaks.');
    if (!tags.has(name.toLowerCase())) tags.set(name.toLowerCase(), name);
  }
  return [...tags.values()];
}
export function normalizeSaveDetails(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['sourceTitle', 'noteText', 'userTags', 'folderId'].includes(key))) throw new Error('Invalid save details.');
  const details = {};
  for (const [key, max, label] of [['sourceTitle', 1000, 'Title'], ['noteText', 50000, 'Note']]) {
    if (!(key in value)) continue;
    if (typeof value[key] !== 'string' || value[key].length > max) throw new Error(`${label} must be ${max.toLocaleString()} characters or fewer.`);
    details[key] = value[key].trim() || null;
  }
  if ('userTags' in value) details.userTags = normalizeSaveTags(value.userTags);
  if ('folderId' in value) {
    if (value.folderId !== null && (typeof value.folderId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.folderId))) throw new Error('Choose a valid folder.');
    details.folderId = value.folderId;
  }
  return details;
}
