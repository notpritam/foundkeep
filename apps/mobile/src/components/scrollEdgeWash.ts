/** What the native and web scroll edges share (kept apart so the web never loads expo-backdrop). */
/** hold: the share of the height, from the edge, kept at full strength (where a bar's title and buttons sit)
 * before the blur fades away. */
export type ScrollEdgeProps = { edge: 'top' | 'bottom'; height: number; color: string; hold?: number };
/** The page colour at 85%, as the wash rising to the blurred edge. */
export const wash = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}d9` : color);
