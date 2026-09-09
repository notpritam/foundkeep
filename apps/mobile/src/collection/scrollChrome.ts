/** Scroll geometry only. No list layout changes and no React render per frame. */
export function createScrollChrome(initialHeight: number) {
  let height = initialHeight, previous = 0, hidden = 0, upward = 0;
  return {
    resize(value: number) { height = Math.max(0, value); hidden = Math.min(hidden, height); return hidden; },
    reveal() { hidden = 0; upward = 0; return hidden; },
    scroll(offset: number, maximum: number, locked = false) {
      // iOS rubber-banding at either edge must not reverse the toolbar.
      const next = Math.max(0, Math.min(offset, Math.max(0, maximum)));
      const delta = next - previous; previous = next;
      if (locked || next <= 0) { hidden = 0; upward = 0; return hidden; }
      if (delta > 0) { hidden = Math.min(height, hidden + delta); upward = 0; }
      else if (delta < 0) {
        const before = upward; upward -= delta;
        if (upward >= 8) hidden = Math.max(0, hidden + delta - (before < 8 ? before : 0));
      }
      return hidden;
    },
  };
}
