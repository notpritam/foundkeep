# Atlas Studio + Operator Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for the independent work below, with review before delivery.

**Goal:** Deliver a working combined landing page and coherent extension redesign as an isolated preview and installable ZIP.

**Architecture:** Preserve native extension modules and storage. Separate connection presentation into shared UI helpers. Leave existing agent-control worker and protocol unchanged. Capture, collecting and retrieval lead following the user’s clarification.

**Stack:** Static HTML, CSS, JavaScript, Manifest V3; installed Playwright/Chromium for UI verification and node:test for isolated control behavior.

**Spec:** `PRODUCT.md`, `DESIGN.md`, original five concepts, and the user's selection of 04 + Operator.

## Global constraints
- Work only in this worktree; no production deployment or mutations of user data.
- Preserve database schema, settings keys, extension key, capture actions and external control protocol.
- No new permissions, pricing, model integrations, cloud sync or semantic-search claims.
- One brand accent: vermilion. Use real screenshots or explicitly labeled working demos.
- All settings and permissions must have accurate states, actionable errors and keyboard-accessible controls.

## Task 1: Landing page (independent)
- [ ] Replace `apps/web/index.html`, `styles.css`, `app.js` with the approved combination and complete responsive page.
- [ ] Keep Get Atlas installation/download flow truthful. Links to hosted access use absolute existing production /redeem URL in preview.
- [ ] Use `assets/studio-architecture.png`, `assets/extension-library.png`, `assets/extension-popup.png` supplied by the coordinator. Demo actions are local illustration only and labeled.
- [ ] Update privacy content to accurately describe local capture, optional model processing and relay page transit.
- [ ] Verify navigation, interactive demo, FAQ, reduced motion, desktop/mobile layout.

## Task 3: Extension product UI (coordinator)
- [ ] Redesign popup with capture actions, actionable saved-item list, pending/success/error save behavior and saved-item navigation.
- [ ] Redesign library with responsive navigation, keyword search, filters, accessible card activation, detail dialog and connection settings. Fix overlay visibility and unsafe source-link interpolation.
- [ ] Use shared `connections.js` and `theme.css` for consistent settings fields and truthful statuses; preserve existing keys.
- [ ] Leave agent-control content script and worker unchanged; keep relay configuration in advanced settings.
- [ ] Verify empty/populated library, search/filter, failed/successful save, settings persistence, modal focus, safe links and existing connection settings in isolated browser.

## Task 4: Integration and delivery
- [ ] Capture real redesigned extension UI with labeled synthetic sample data for landing assets.
- [ ] Bundle preview extension without signing secrets. Bump package version only after tests; retain same identity and protocol.
- [ ] Run bounded desktop/mobile visual inspection, mechanical design detector and independent finish review; resolve blocking findings.
- [ ] Preserve source and screenshots, expose the preview with BB Connect, supply download and concise remaining deployment state.
