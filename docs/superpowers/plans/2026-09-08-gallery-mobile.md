# Foundkeep Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the selected Gallery collection, correct the in-app mark, and simplify sign-in with useful previews and reliable item access.

**Architecture:** Reuse the existing customer API and account-scoped cache. Add authenticated native image access and batch filtering; render a virtualized, adaptive grid using shared preview/card components. Keep original capture provenance immutable when editing personal title/note fields.

**Tech Stack:** Expo 57, React Native 0.86, Expo Router, Bun/Hono/SQLite, existing React Native Image (no additional native dependency required for initial previews).

**Spec:** `docs/design/mobile-v2/README.md`. User selected **02 Gallery** on 2026-09-08, requested canonical Foundkeep icon and very short terms copy.

## Global Constraints

- Foundkeep version remains **1.0.0**.
- Use canonical folded bookmark artwork from existing app assets; no replacement brand.
- Sign-in footer: “By continuing, you agree to our Terms and Privacy Policy.” Keep Terms and Privacy Policy clickable.
- Never forward Foundkeep authorization to a source website. Native blob/file access remains account-scoped.
- Gallery is the default; large accessibility text falls back to one column. All saved types and grouped children remain accessible.
- OAuth remains a separate auth subsystem in the parent spec; do not present nonfunctional social-login buttons as live.

### Task 1: Native preview and edit API

Files: `apps/backend/src/customer.ts`, `apps/backend/test/customer.test.ts`, mobile API client/types/model and tests.

- [ ] Reproduce cookie-only blob access and missing batch/edit flows in customer API tests.
- [ ] Add native bearer-authenticated blob route and account-scoped batch filter.
- [ ] Add version-checked personal title/note editing; preserve provenance and enforce existing storage limits.
- [ ] Add preview-source resolver with trusted-origin authorization and unit tests.
- [ ] Run customer and mobile tests.

### Task 2: Gallery collection and detail

Files: mobile shared theme/UI, collection components/screens, detail screen, app navigation.

- [ ] Extract data loading from visual cards; retain existing cache/debounce/generation guards.
- [ ] Add adaptive virtualized Gallery tiles with actual image loading/error states and readable type-specific fallbacks.
- [ ] Add grouped-item sheet/navigation with cursor support and detail image/edit flows.
- [ ] Use a native stack for detail and a sheet for editing/new notes; preserve back gestures and safe areas.
- [ ] Add light/dark tokens and support large text without clipping.

### Task 3: Brand, sign-in and first-use polish

Files: mobile Mark, welcome/sign-in/register, onboarding route, design prototype/docs.

- [ ] Replace hand-drawn outline with the existing canonical icon.
- [ ] Shorten shared legal footer and clean form spacing/keyboard behavior.
- [ ] Add skippable share setup guidance; returning users keep their collection/deep-link destination.
- [ ] Update prototype to mark Gallery selected and use corrected icon/short footer.

### Task 4: Verify and preserve

- [ ] Run unit/API tests, TypeScript and compiled-app interaction checks.
- [ ] Run on available Mac Simulator and capture phone light/dark/large text; record any unavailable native checks explicitly.
- [ ] Obtain the required independent Impeccable finish review and address material findings.
- [ ] Record chosen direction and remaining OAuth/offline-cache requirements; commit verified work.

## Accepted additions during implementation

- Keep collection header, search, folder/tag filter, and type filters sticky.
- Card-shaped shimmer and image crossfades respect Reduce Motion and stop offscreen/backgrounded.
- One optional folder and up to 20 personal tags per save; starter suggestions are opt-in. Users can create/rename/delete folders and add their own tags. Derived tags remain separate from manual tags.
- Folder and tag choices persist atomically through note saves, capture edits, iPhone Share Extension uploads, and the durable retry queue. Native Share Extension changes require a new binary; app version stays 1.0.0.
