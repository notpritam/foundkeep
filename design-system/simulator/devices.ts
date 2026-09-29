// The devices the simulator can frame. Sizes are CSS pixels; insets are the
// safe areas the real screens must respect (status bar, notch, home indicator).
export type Device = { id: string; label: string; kind: 'phone' | 'tablet' | 'laptop' | 'desktop'; width: number; height: number;
  insets: { top: number; bottom: number; left: number; right: number }; radius: number; island?: boolean; platform: 'ios' | 'android' | 'web' };

export const DEVICES: Record<string, Device> = {
  'iphone-17-pro': { id: 'iphone-17-pro', label: 'iPhone 17 Pro', kind: 'phone', width: 402, height: 874, insets: { top: 62, bottom: 34, left: 0, right: 0 }, radius: 62, island: true, platform: 'ios' },
  'iphone-se': { id: 'iphone-se', label: 'iPhone SE', kind: 'phone', width: 375, height: 667, insets: { top: 20, bottom: 0, left: 0, right: 0 }, radius: 0, platform: 'ios' },
  'pixel-9': { id: 'pixel-9', label: 'Pixel 9', kind: 'phone', width: 412, height: 915, insets: { top: 48, bottom: 24, left: 0, right: 0 }, radius: 48, platform: 'android' },
  ipad: { id: 'ipad', label: 'iPad', kind: 'tablet', width: 820, height: 1180, insets: { top: 24, bottom: 20, left: 0, right: 0 }, radius: 36, platform: 'ios' },
  laptop: { id: 'laptop', label: 'Laptop (1280)', kind: 'laptop', width: 1280, height: 800, insets: { top: 0, bottom: 0, left: 0, right: 0 }, radius: 10, platform: 'web' },
  desktop: { id: 'desktop', label: 'Desktop (1440)', kind: 'desktop', width: 1440, height: 900, insets: { top: 0, bottom: 0, left: 0, right: 0 }, radius: 10, platform: 'web' },
};

const item = (id: string) => ({ value: id, title: DEVICES[id].label });
export const APP_DEVICES = ['iphone-17-pro', 'iphone-se', 'pixel-9', 'ipad'].map(item);
export const WEB_DEVICES = ['desktop', 'laptop', 'ipad', 'iphone-17-pro'].map(item);

/** Toolbar globals shared by the App and Dashboard Storybooks. */
export const simulatorGlobals = (devices: { value: string; title: string }[], extra: Record<string, unknown> = {}) => ({
  device: { description: 'Device the screen is framed in', toolbar: { title: 'Device', icon: 'mobile', items: devices, dynamicTitle: true } },
  theme: { description: 'Light or dark', toolbar: { title: 'Theme', icon: 'mirror', items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }], dynamicTitle: true } },
  ...extra,
});
export const textSizeGlobal = { textSize: { description: 'Text size (iOS Dynamic Type, Android font scale)', toolbar: { title: 'Text size', icon: 'paragraph', items: [{ value: '1', title: 'Text 100%' }, { value: '1.35', title: 'Text 135%' }, { value: '2', title: 'Text 200%' }], dynamicTitle: true } } };
export const accessibilityGlobals = {
  motion: { description: 'Reduce motion', toolbar: { title: 'Motion', icon: 'play', items: [{ value: 'full', title: 'Full motion' }, { value: 'reduced', title: 'Reduced motion' }], dynamicTitle: true } },
  transparency: { description: 'Reduce transparency', toolbar: { title: 'Transparency', icon: 'contrast', items: [{ value: 'full', title: 'Full transparency' }, { value: 'reduced', title: 'Reduced transparency' }], dynamicTitle: true } },
};
