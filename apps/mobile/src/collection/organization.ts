export const STARTER_TAGS = ['Read later', 'Inspiration', 'Work', 'Personal'];
export function addUserTag(tags: string[], value: string): { tags: string[]; error: string | null } {
  const name = value.trim().replace(/^#/, '').trim();
  if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) return { tags, error: 'Use a tag between 1 and 40 characters.' };
  if (tags.some(tag => tag.toLocaleLowerCase() === name.toLocaleLowerCase())) return { tags, error: null };
  if (tags.length >= 20) return { tags, error: 'You can attach up to 20 tags.' };
  return { tags: [...tags, name], error: null };
}
