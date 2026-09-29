// Generated from design-system/tokens.json by design-system/scripts/tokens.mjs. Edit the JSON, not this file.
export const tokens = {
  "color": {
    "light": {
      "bg": "#fafafa",
      "sidebar": "#fff",
      "card": "#fff",
      "panel": "#f1f3f1",
      "hover": "#e6ece7",
      "line": "#e4e4e4",
      "control": "#929292",
      "ink": "#202020",
      "muted": "#686868",
      "faint": "#686868",
      "accent": "#0d7a50",
      "button": "#0d7a50",
      "buttonHover": "#0a6242",
      "onButton": "#fff",
      "accentBg": "#e6f2ea",
      "good": "#286c56",
      "bad": "#ad3b35"
    },
    "dark": {
      "bg": "#08090a",
      "sidebar": "#0f1011",
      "card": "#0f1011",
      "panel": "#1a1c20",
      "hover": "#262a2e",
      "line": "#34373d",
      "control": "#646872",
      "ink": "#f7f8f8",
      "muted": "#a5aab2",
      "faint": "#a5aab2",
      "accent": "#4cc38a",
      "button": "#4cc38a",
      "buttonHover": "#6bd3a1",
      "onButton": "#05130d",
      "accentBg": "#163426",
      "good": "#a7d4b1",
      "bad": "#ffb5a8"
    }
  },
  "space": {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32
  },
  "radius": {
    "sm": 8,
    "md": 10,
    "lg": 12,
    "xl": 16,
    "full": 999
  },
  "control": {
    "sm": 30,
    "md": 36,
    "lg": 40
  },
  "text": {
    "title": {
      "fontWeight": "600",
      "fontSize": 16,
      "lineHeight": 21.6
    },
    "body": {
      "fontWeight": "400",
      "fontSize": 13.5,
      "lineHeight": 20.3
    },
    "label": {
      "fontWeight": "500",
      "fontSize": 12.5,
      "lineHeight": 12.5
    },
    "caption": {
      "fontWeight": "400",
      "fontSize": 12,
      "lineHeight": 18
    },
    "micro": {
      "fontWeight": "500",
      "fontSize": 11.5,
      "lineHeight": 13.8
    }
  },
  "shadow": {
    "light": {
      "popover": "0 16px 40px rgba(0, 0, 0, .18), 0 2px 6px rgba(0, 0, 0, .06)",
      "card": "0 18px 48px rgba(0, 0, 0, .16), 0 2px 6px rgba(0, 0, 0, .06)"
    },
    "dark": {
      "popover": "0 16px 40px rgba(0, 0, 0, .55)",
      "card": "0 18px 48px rgba(0, 0, 0, .6)"
    }
  },
  "fontFamily": "Inter"
} as const;

export type ColorName = keyof typeof tokens.color.light;
export type Scheme = keyof typeof tokens.color;
