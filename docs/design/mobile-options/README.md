# Foundkeep mobile direction comparison

September 10, 2026. Chosen direction: **Quiet Collection for the app, Glass Horizon for gallery cards and saved-item details**. Open directly to provider-first sign-in; remove the welcome/Get started step. The two-column gallery and subtle floating glass dock remain.

Implemented in the Expo app on `feat/mobile-scenic-glass`. Email expands on request, existing sessions bypass authentication, and old welcome links redirect to the current entry flow. Folder/tag filters share a row with content filters. Settings and the share guide use quieter sections; cards and reader headers use rounded image previews with overlapping frosted captions.

Verification: TypeScript, 50 mobile unit tests, web and iOS exports, compiled browser gallery/auth/OAuth checks. Browser coverage includes narrow layouts, direct/legacy entry links, session redirects, registration/recovery, organized note saving, long articles, private images, dark mode, reduced transparency, increased contrast, scrolling chrome and related saves. On the Mac, a frozen-lockfile install reproduces build 15’s runtime `03660500bff0bed464c73b169d8c9f0d01e85f19`. Native visual verification passed and the hybrid is live over the air for TestFlight 1.0.0 (15). See [release evidence](../mobile-quiet-glass-release.md).

Live review: [Mobile directions](https://omni--8934.getbb.app/?screen=welcome&view=all).

This is a browser design prototype using sample content, not the installed app. All assets are bundled locally from Foundkeep's existing artwork and reference library. It never contacts production auth or capture APIs. Forms, provider buttons, files and source links demonstrate the flow without creating accounts, sending credentials or uploading data.

## Three directions

| Direction | Main difference | Welcome approach |
| --- | --- | --- |
| A · Alpine Light | Bright reading surfaces; restrained alpine background; glass navigation; two-column cards | Framed scenery and example saves, followed by a short headline and one CTA |
| B · Glass Horizon | Scenic depth; more translucent sheets; a featured image followed by smaller cards | Save cards floating over scenery; content settles onto a pale background |
| C · Quiet Collection | Editorial typography, fewer containers, flat image gallery, subtle frosted dock | A short introduction above a small collage; a quiet paper surface |

The approved combination uses **C** for the overall interface and **B** for saved content. The comparison below remains available as a record of the explored directions.

## Coverage: 42 variants

Three versions each of welcome, sign-in, registration, share guide, gallery, saved item, note composer, folders/tags, settings, grouped saves, empty collection, account recovery, recovery-code display and OAuth return.

Use the Screen dropdown or Next screen. Navigation inside a phone switches all three phones to the same destination so comparison stays coherent. Use A/B/C for a larger individual view. Search, filters, gallery scroll, note editing, email disclosure, folder creation, tag creation and preference toggles can be tried with sample data.

## Choosing

“Choose this screen” records an individual preference. “Use for all” selects a direction for every screen. “Your choices” allows adjusting each selection. “Send choices” writes the selected screen/direction pairs for the agent to read.

Selections are stored in this browser's localStorage until sent. The preview server writes the submitted selection to `FOUNDKEEP_CHOICE_FILE`, or `$BB_THREAD_STORAGE/foundkeep-mobile-direction-choices.json`, falling back to `/tmp/foundkeep-mobile-direction-choices.json`. The running preview uses that last path. Files are mode 0600 and contain only chosen direction IDs and a timestamp. Submission does not start a deployment.

## Verification

`node docs/design/mobile-options/verify.mjs` passed all 42 variants at desktop (1440), phone (390) and narrow phone (320) widths. It checks horizontal fit, welcome CTA visibility above the home indicator, local assets, navigation, email disclosure, search/filtering, compact scroll chrome, note editing, folder/tag controls, saved selections, choose-all, choice handoff, reduced motion and invalid URL defaults. Its simulated submission is intercepted so tests cannot replace user preferences.

Screenshot evidence is under `.impeccable/review/mobile-options/`: welcome, gallery, sign-in, saved item, organization and settings comparisons, plus a single-direction phone preview. This is visual/browser evidence only, not native Liquid Glass or Dynamic Type verification.

Start with `node docs/design/mobile-options/serve.mjs` (port 8934 by default; override with `PORT`). Expose the active port through `bb connect expose 8934` for remote review.

Release the selected hybrid after native verification. Keep version 1.0.0; use EAS Update only when the runtime matches the installed TestFlight binary.
