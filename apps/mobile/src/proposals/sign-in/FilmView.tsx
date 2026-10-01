// The sign-in window's film (design-system/film, rendered to assets/video):
// FoundKeep at work in an 11-second loop. On the web it plays as a muted,
// looping video. With Reduce Motion, and on iPhone until this version is
// picked (playing it there needs expo-video), the poster frame shows instead.
import { createElement } from 'react';
import { Image, Platform, StyleSheet } from 'react-native';

// soft: the same film with its sky far more blurred, for the version on the sky page.
const FILMS = {
  clear: { video: require('../../../assets/video/sign-in-film.mp4'), poster: require('../../../assets/video/sign-in-film.jpg') },
  soft: { video: require('../../../assets/video/sign-in-film-soft.mp4'), poster: require('../../../assets/video/sign-in-film-soft.jpg') },
};
const url = (asset: unknown) => typeof asset === 'string' ? asset : (asset as { default?: string; uri?: string } | null)?.default ?? (asset as { uri?: string } | null)?.uri;

export function FilmView({ motion, soft = false }: { motion: boolean; soft?: boolean }) {
  const film = FILMS[soft ? 'soft' : 'clear'];
  if (Platform.OS === 'web' && motion) return createElement('video', { src: url(film.video), poster: url(film.poster), autoPlay: true, loop: true, muted: true, playsInline: true, 'aria-hidden': true,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' } });
  return <Image source={film.poster} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />;
}
