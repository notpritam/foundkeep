import { mediaHost, type SocialManifest, type SocialResolver } from './customer-social-types.ts';
export function parseYouTubeOembed(json: unknown, id: string): SocialManifest {
  const v = json as any;
  if (!v || typeof v.title !== 'string') throw Error('The public video is unavailable.');
  const media: SocialManifest['media'] = [{ kind: 'video', url: `https://www.youtube.com/watch?v=${id}` }];
  if (mediaHost(v.thumbnail_url, ['ytimg.com'])) media.push({ kind: 'image', url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` });
  return { text: v.title.slice(0, 1000), author: typeof v.author_name === 'string' ? v.author_name.slice(0, 200) : '', publishedAt: null, media, links: [], metadataAvailable: true };
}
export const resolveYouTube: SocialResolver = async (post, hints, signal, deps) => {
  try {
    const r = await deps.read(`https://www.youtube.com/oembed?url=${encodeURIComponent(post.url)}&format=json`, { maxBytes: 64 * 1024, signal, accept: 'application/json' });
    const m = parseYouTubeOembed(JSON.parse(r.data.toString('utf8')), post.id); m.links = hints.links.slice(0, 3); return m;
  } catch { signal.throwIfAborted(); return { text: '', author: '', publishedAt: null, media: [{ kind: 'video', url: post.url }], links: hints.links.slice(0, 3), metadataAvailable: false }; }
};
