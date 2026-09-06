# Atlas landing implementation

## Delivered

Replaced the prior purple/agent-led marketing page with the approved Atlas Studio direction using Operator's crisp dark product surfaces. The headline is “Found it? Keep it.” The page uses self-hosted Clarity City Bold for display, Geist for UI, paper `#f3f3f0`, ink `#171917`, and vermilion `#c63b23`.

Implemented:
- Graphic hero with architectural capture selection, authored typographic specimen, sample highlight, actual popup screenshot, and dark library screenshot strip.
- Six capture formats, followed by a working, explicitly labeled illustrative highlight capture. Saving changes only the current DOM; resetting restores the empty state. It never touches storage or the real library.
- Actual library screenshot, keyword/type/tag/category retrieval copy, source-context and local-storage explanations.
- Optional OCR/summary/tag enrichment, with clear model-provider data-flow disclosure.
- Complete manual ZIP installation instructions; Get Atlas anchors lead to the installation area. Download uses the existing real `atlas-extension.zip`. Copy-address action includes success and clipboard-denied feedback.
- Native keyboard-accessible FAQ. Browser control appears only in one advanced FAQ answer. Hosted invite redemption uses absolute `https://atlas.notpritam.in/redeem`.
- Privacy page rewritten around factual capture storage, optional enrichment/model providers, local bridge/hosted relay transit, browser permission groups, and limits of local deletion. No invented analytics, retention, sale, or contractual policy promises.
- New page-only monochrome `assets/studio-mark.svg`; existing shared marks remain untouched.

## Owned files

- `apps/web/index.html`
- `apps/web/styles.css`
- `apps/web/app.js`
- `apps/web/privacy.html`
- `apps/web/assets/studio-mark.svg`
- This report

No extension/backend/shared-document/package/ZIP edits. No production deployment.

## Verification

`node --check apps/web/app.js` passed.

A bounded Playwright functional check ran through installed Playwright Core and Chromium against port 9047:
- Demo save/reset state and item count.
- Disabled save after capture and focus transfer to Reset demo; Enter resets and restores focus to Save.
- Clipboard success (including reading the actual copied address) and simulated permission-denied fallback.
- FAQ opens by keyboard.
- Real ZIP responds 200 and starts with ZIP `PK` signature.
- Absolute relay invitation URL present.
- Privacy page and return navigation work under `/apps/web/` preview path.
- Reduced-motion media setting yields `scroll-behavior: auto`.
- No JavaScript page errors.
- No document/element horizontal overflow at viewport widths 320, 390, 768, 1024, 1440, or 1920.

The temporary check script is `/tmp/atlas-landing-check.mjs`. It is not a shipped test dependency. Initial test attempt asserted clipboard state before its async promise completed; the harness was corrected to await the status. No application fix was needed. The same check was rerun after stylesheet-only formatting and passed.

Mechanical detector ran once against all four web files. It reported degraded parser mode (HTML/CSS parser modules missing), so no full selector/computed contrast evaluation is claimed. It only flagged Geist twice as an overused font; Geist is explicitly required by the approved brief. Output: `/tmp/atlas-landing-detector.json`.

## Integration dependency / visual handoff

The controller supplied `apps/web/assets/studio-architecture.png` before commit. I inspected it with view_image and updated the intrinsic dimensions/alt text to the real 1536×1024 stairway, olive tree and vermilion doorway image. Two controller-owned real screenshot assets are pending:
- `apps/web/assets/extension-library.png`
- `apps/web/assets/extension-popup.png`

No old screenshot or placeholder was substituted. **Visual screenshot inspection remains pending those assets.** Functional layout checks above passed with the reserved image boxes; this is not a claim that the final imagery was inspected. Parent/controller should capture desktop (1440 or approved-comp 1536 width) and mobile (390 width) after supplying the assets, and pass them to the independent finish reviewer.

Image treatments are deliberate: architecture uses the supplied landscape source with object-fit cover; hero library strip crops the top of the actual full library screenshot; the dedicated library section shows the complete desktop screenshot, with a small mobile cover crop to retain height. Popup preserves its natural aspect ratio. Images declare reserved intrinsic dimensions (architecture 1536×1024, library 1440×900, popup 440×680), so update these if the final assets differ materially.

Static preview was started at `http://127.0.0.1:9047/apps/web/`, Python server session 40465, serving the isolated worktree. The coordinator owns BB Connect exposure and user-facing public links.
