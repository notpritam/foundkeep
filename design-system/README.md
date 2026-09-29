# FoundKeep design system (Storybook)

Live components built from the product's own source — `apps/extension/src`
`theme.css`, `review.css`, `review.html`, `save-details.js` and the icons in
`dock/dock.js` — so nothing here is redrawn or screenshotted.

```bash
cd design-system
/usr/bin/node /usr/bin/npm install          # own node_modules; never the repo root's
/usr/bin/node node_modules/.bin/storybook dev -p 8814 --no-open   # live reload
/usr/bin/node node_modules/.bin/storybook build -o dist --quiet   # static build
```

On omni the static build is served by the user unit `foundkeep-storybook`
(`python3 -m http.server 8814` on `dist/`) and shared with bb Connect at
https://omni--8814.getbb.app — rebuild after a change; no restart needed.

- `src/card.js` builds the Add details card and each control from a clone of
  `review.html`; the tag control is the real `bindSaveTags()`.
- `src/matrix.js` is the "All states · light & dark" view: one block per state,
  light and dark side by side, wrapping to the canvas width.
- `src/dock-source.js` reads the dock's icons and CSS out of `dock.js`.
- Hover, focus and pressed come from `storybook-addon-pseudo-states`; the
  toolbar's Theme sets `data-theme` on `<html>` like the extension does.
