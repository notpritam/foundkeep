export function createScrollChrome(initialHeight) {
  let height = initialHeight, previous = 0, hidden = 0, upward = 0;
  return {
    resize(value) {
      height = Math.max(0, value);
      hidden = Math.min(hidden, height);
      return hidden;
    },
    reveal() {
      hidden = 0;
      upward = 0;
      return hidden;
    },
    scroll(offset, maximum, locked = false) {
      const next = Math.max(0, Math.min(offset, Math.max(0, maximum)));
      const delta = next - previous;
      previous = next;
      if (locked || next <= 0) {
        hidden = 0;
        upward = 0;
        return hidden;
      }
      if (delta > 0) {
        hidden = Math.min(height, hidden + delta);
        upward = 0;
      } else if (delta < 0) {
        const before = upward;
        upward -= delta;
        if (upward >= 8)
          hidden = Math.max(0, hidden + delta - (before < 8 ? before : 0));
      }
      return hidden;
    }
  };
}
