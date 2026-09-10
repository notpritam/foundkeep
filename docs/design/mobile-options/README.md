# Foundkeep mobile direction comparison

September 10, 2026. The user rejected the scenic welcome screen and requested multiple variants of every screen before choosing. Native release work is on hold for that design choice; the Mac connection was confirmed, but no native build or OTA update was submitted in this pass.

Live review: [Mobile directions](https://omni--8934.getbb.app/?screen=welcome&view=all).

This is a browser design prototype using sample content, not the installed app. All assets are bundled locally from Foundkeep's existing artwork and reference library. It never contacts production auth or capture APIs. Forms, provider buttons, files and source links demonstrate the flow without creating accounts, sending credentials or uploading data.

## Three directions

| Direction | Main difference | Welcome approach |
| --- | --- | --- |
| A · Alpine Light | Bright reading surfaces; restrained alpine background; glass navigation; two-column cards | Framed scenery and example saves, followed by a short headline and one CTA |
| B · Glass Horizon | Scenic depth; more translucent sheets; a featured image followed by smaller cards | Save cards floating over scenery; content settles onto a pale background |
| C · Quiet Collection | Editorial typography, fewer containers, flat image gallery, subtle frosted dock | A short introduction above a small collage; a quiet paper surface |

Recommendation: **A** keeps the relationship to the landing page while protecting clarity. B makes more of the glass effect; C gives saved content the most visual emphasis. Each direction is a consistent system, but the user can mix screens.

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

After the user chooses, apply the selected design to the Expo app and resume native iPhone verification, runtime compatibility checks and TestFlight/OTA delivery. Keep version 1.0.0.
