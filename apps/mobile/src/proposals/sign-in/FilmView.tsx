// The sign-in window's film (design-system/film, rendered to assets/video):
// FoundKeep at work in an 11-second loop. On the web it plays as a muted,
// looping video. With Reduce Motion, and on iPhone until this version is
// picked (playing it there needs expo-video), the poster frame shows instead.
import { createElement } from 'react';
import { Image, Platform, StyleSheet } from 'react-native';

const FILM = require('../../../assets/video/sign-in-film.mp4');
const POSTER = require('../../../assets/video/sign-in-film.jpg');
const url = (asset: unknown) => typeof asset === 'string' ? asset : (asset as { default?: string; uri?: string } | null)?.default ?? (asset as { uri?: string } | null)?.uri;

export function FilmView({ motion }: { motion: boolean }) {
  if (Platform.OS === 'web' && motion) return createElement('video', { src: url(FILM), poster: url(POSTER), autoPlay: true, loop: true, muted: true, playsInline: true, 'aria-hidden': true,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' } });
  return <Image source={POSTER} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />;
}
