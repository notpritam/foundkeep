# App and dashboard design foundation — implementation plan (phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Storybook address that shows the extension, the real app and the real dashboard, every current screen on sample data, inside a simulator with device frames and a live demo of the running products. It is the base every later proposal round builds on.

**Architecture:** The existing html-vite Storybook in `design-system/` becomes a hub that composes two new Storybooks: `design-system/app/` (`@storybook/react-native-web-vite`, rendering `apps/mobile/src`) and `design-system/dashboard/` (`@storybook/nextjs-vite`, rendering `apps/site`). One `design-system/tokens.json` generates each product's token file. Shared sample data in `design-system/fixtures/` feeds the app through its API client's `fetcher` option and the dashboard through a fetch router installed in its Storybook preview. A demo gateway runs the real app and dashboard against a throwaway backend for the Live entries.

**Tech Stack:** Storybook 10.6 (html-vite, react-native-web-vite, nextjs-vite), Vite 8, React 19.2.3 (app) / 19.3.0 (dashboard), React Native 0.86.3 + react-native-web 0.21.2, Expo 57, Next 16.3.4, playwright-core for checks, bun for the backend.

**Spec:** `docs/superpowers/specs/2026-09-29-product-design-system-design.md`

## Global Constraints

- Each Storybook package has its own `package.json` and `node_modules`; nothing is installed into the repo root `node_modules`.
- The app Storybook uses the repo root's React 19.2.3 / react-native-web; the dashboard Storybook uses `apps/site/node_modules` React 19.3.0. Exactly one React copy per Storybook (alias + dedupe).
- Emerald accent; dark theme layered near-black; never pure black, never blue or indigo.
- Ports: 8814 Storybook (existing), 8817 demo backend (loopback), 8818 demo gateway (public via bb Connect), 8819 demo Next server (loopback). Register them in `~/personal/CLAUDE.md`.
- Only the demo gateway may be framed, and only by the Storybook origin.
- `/usr/bin/node` for scripts (the shell's `node` is an nvm shim); `/usr/bin/npm` for installs.
- Product screens are not restyled in this phase. The app keeps `palettes.json` until its flows are rebuilt; the extension's `theme.css` output is byte-for-byte what it is today.
- Merge to `main` and push after each task that leaves Storybook working (small merges, never one bulk merge). Rebuild and restart the Storybook service after each merge.

## Review Focus

1. **Two Reacts in one Storybook** (a hook error "Invalid hook call" or a blank canvas) — every render check asserts no console errors.
2. **Dark theme in stories** — the theme toolbar must flip both the app's `AppearanceProvider` scheme and the dashboard's `data-theme`; the render check runs both themes.
3. **Large text** — at 200% text size a screen must not throw; the render check runs one pass at 200% for app stories.
4. **Screens that need a route param** (capture/[id], batch/[id], collection/[id]) — each has a story per param value and never renders an empty "not found" by accident; the story asserts its title text is present.
5. **Live demo reset** — reseeding while a browser session exists must not leave the demo signed into a deleted account; the seed script reuses the one demo account and replaces its data.

---

### Task 1: App Storybook renders a real app component

**Files:**
- Create: `design-system/app/package.json`, `design-system/app/.storybook/main.ts`, `design-system/app/.storybook/preview.tsx`, `design-system/app/src/GalleryCard.stories.tsx`
- Create: `design-system/scripts/render-check.mjs` (used by every later task)

**Interfaces:**
- Produces: `design-system/app` builds with `npx storybook build -o ../dist/app`; `render-check.mjs <storybook-url>` loads every story in `index.json` and exits 1 on any console error.

- [ ] **Step 1: Package** — `design-system/app/package.json`:

```json
{ "name": "@foundkeep/design-app", "private": true, "type": "module",
  "scripts": { "storybook": "storybook dev -p 6107 --no-open", "build": "storybook build -o ../dist/app --quiet" },
  "devDependencies": { "storybook": "10.6.0", "@storybook/react-native-web-vite": "10.6.0", "@storybook/addon-docs": "10.6.0", "vite": "^8.3.1" } }
```

Install with `/usr/bin/npm install --legacy-peer-deps` so React, React Native and react-native-web are not installed again; they resolve from the repo root.

- [ ] **Step 2: Config** — `main.ts` points stories at `../src/**/*.stories.tsx` and `../../../apps/mobile/src/**/*.stories.tsx`, uses the `@storybook/react-native-web-vite` framework, and in `viteFinal` aliases `react`, `react-dom`, `react-native`, `react-native-web` to the repo root copies (`path.resolve(root, 'node_modules/<name>')`) with `resolve.dedupe` set to the same list. Expo packages that ship untranspiled code are listed in the framework's `pluginReactOptions`/`optimizeDeps.include` as needed until the build passes.

- [ ] **Step 3: Preview** — wraps every story in `SafeAreaProvider`, the app's `AppearanceProvider` and `MaterialProvider` (from `apps/mobile/src/components/ScenicSurface.tsx`).

- [ ] **Step 4: Story** — `GalleryCard.stories.tsx` renders `apps/mobile/src/components/GalleryCard.tsx` with one bookmark capture object typed as `Capture` from `apps/mobile/src/api/types.ts`.

- [ ] **Step 5: Render check** — `render-check.mjs`: fetch `<url>/index.json`, for every entry of type `story` open `<url>/iframe.html?id=<id>&viewMode=story` in playwright-core Chromium (channel `chromium`), wait for `#storybook-root` to have children, collect `console` errors and `pageerror`s, print a table, exit 1 if any. Options `--globals theme:dark` etc. are passed through as `&globals=`. It also injects axe-core and records serious/critical violations: reported only for stories titled `*/Current/*` (today's screens are the baseline), failing for everything else (components and proposals).

- [ ] **Step 6: Verify** — `cd design-system/app && /usr/bin/npm run build` succeeds; serve `design-system/dist/app` on a scratch port; `/usr/bin/node ../scripts/render-check.mjs http://127.0.0.1:<port>` passes; screenshot the story and look at it.

- [ ] **Step 7: Commit and merge** — commit on `feat/product-design`, merge to `main` with `--no-ff`, push both.

### Task 2: Dashboard Storybook renders a real dashboard component

**Files:**
- Create: `design-system/dashboard/package.json`, `.storybook/main.ts`, `.storybook/preview.tsx`, `src/CaptureCard.stories.tsx`

**Interfaces:**
- Produces: `design-system/dashboard` builds to `../dist/dashboard`.

- [ ] **Step 1: Package** with `storybook`, `@storybook/nextjs-vite`, `@storybook/addon-docs` 10.6.0 and `vite`, installed `--legacy-peer-deps`.
- [ ] **Step 2: Config** — stories from `../src/**` and `../../../apps/site/components/**/*.stories.tsx`; `viteFinal` aliases `react`, `react-dom` (and `react/jsx-runtime`) to `apps/site/node_modules/*`, `next` to the repo root copy; dedupe them.
- [ ] **Step 3: Preview** imports the dashboard's global CSS (`apps/site/app/appearance.css`, `apps/site/app/customer.css`, `apps/site/components/dashboard/dashboard.css`) and sets `document.documentElement.dataset.theme` from the theme global.
- [ ] **Step 4: Story** — `CaptureCard.stories.tsx` renders `CaptureCard` from `apps/site/components/dashboard/capture-card.tsx` with a fixture `Capture` (from `apps/site/lib/types`) and `open={() => {}}`.
- [ ] **Step 5: Verify** build + render check + screenshot, as in Task 1.
- [ ] **Step 6: Commit and merge.**

### Task 3: The hub composes both

**Files:**
- Modify: `design-system/.storybook/main.js` (add `refs`), `design-system/package.json` (a `build:all` script), `design-system/src/Welcome.mdx`
- Create: `design-system/scripts/build-all.mjs`

- [ ] **Step 1:** `refs: { app: { title: 'App', url: '/app' }, dashboard: { title: 'Dashboard', url: '/dashboard' } }`. If Storybook rejects relative refs, use the public origin from `FOUNDKEEP_STORYBOOK_ORIGIN` (default `https://omni--8814.getbb.app`).
- [ ] **Step 2:** `build-all.mjs` builds the hub to `dist/`, then the app to `dist/app`, then the dashboard to `dist/dashboard` (hub first, because its build empties `dist/`).
- [ ] **Step 3:** `scripts/dev-extension.mjs` calls `build-all.mjs` instead of the hub-only build.
- [ ] **Step 4: Verify** — `http://127.0.0.1:8814` sidebar shows Extension stories plus App and Dashboard sections; render check passes against all three `index.json`s.
- [ ] **Step 5: Commit, merge, restart `foundkeep-storybook`.**

### Task 4: One token source

**Files:**
- Create: `design-system/tokens.json`, `design-system/scripts/tokens.mjs`, `tests/design-tokens.mjs`
- Generate: `apps/extension/src/theme.css` (unchanged bytes), `apps/mobile/src/ui/tokens.ts` (new), `apps/site/app/tokens.css` (new)

**Interfaces:**
- Produces: `tokens.ts` exports `tokens = { color: { light: {...}, dark: {...} }, space, radius, control, text, shadow }`; `tokens.css` declares `--fk-*` for `:root` and `:root[data-theme=dark]`.

- [ ] **Step 1: Failing test** — `tests/design-tokens.mjs` runs `tokens.mjs --check` and asserts exit 0; asserts `theme.css` equals the committed file.
- [ ] **Step 2:** Extract every value in today's `theme.css` into `tokens.json` (colour light/dark, space, radius, control, text, shadow, ease), keeping the variable names.
- [ ] **Step 3:** `tokens.mjs` writes the three outputs; `--check` compares instead of writing and exits 1 on drift.
- [ ] **Step 4:** Test passes; extension suite still passes (`npm run test:extension`).
- [ ] **Step 5: Commit and merge.**

### Task 5: Sample world

**Files:**
- Create: `design-system/fixtures/world.ts` (accounts, plans, folders, tags, collections, a save of every kind), `design-system/fixtures/images/*`, `design-system/fixtures/app-api.ts`, `design-system/fixtures/dashboard-api.ts`

**Interfaces:**
- Produces: `appFetcher(input, init): Promise<Response>` for `createFoundkeepClient({ getToken, fetcher })` (routes `/api/mobile/me`, `/api/mobile/captures`, `/api/mobile/captures/:id`, `/related`, `/preservation`, `/api/mobile/organization`, `/api/mobile/folders`, `/api/plan`, `/api/auth/providers`); `installDashboardFetch()` wraps `window.fetch` to answer `/api/*` routes the dashboard calls; `world` with `captures` keyed by kind: `bookmark`, `region`, `fullpage`, `image`, `post`, `highlight`, `note`, `document`, `audio`, `batch`, `unsynced`, `archived`.

- [ ] **Step 1:** Write `world.ts` typed against both apps' types.
- [ ] **Step 2:** Routers return `Response.json(...)` for data and the sample image bytes for image URLs; unknown `/api` paths return 404 JSON and log a warning (visible in the render check).
- [ ] **Step 3:** Typecheck with each app's `tsc` config including the fixtures.
- [ ] **Step 4: Commit** (merged with Task 7).

### Task 6: Simulator

**Files:**
- Create: `design-system/simulator/devices.ts`, `design-system/simulator/PhoneFrame.tsx`, `design-system/simulator/BrowserFrame.tsx`
- Modify: both new `preview.tsx` files (globals + decorators)

**Interfaces:**
- Produces: globals `device` (`iphone-17-pro` 402×874, `iphone-se` 375×667, `pixel-9` 412×915, `ipad` 820×1180, `laptop` 1280×800, `desktop` 1440×900), `theme` (`light|dark`), `textSize` (`1|1.35|2`), `motion` (`full|reduced`), `transparency` (`full|reduced`); story parameter `keyboard: true` shows a keyboard.

- [ ] **Step 1:** `devices.ts` with sizes, safe-area insets (17 Pro top 62 / bottom 34; SE 20/0; Pixel 9 48/24; iPad 24/20) and radius.
- [ ] **Step 2:** `PhoneFrame` draws the device outline, status bar (time 9:41, signal, battery), Dynamic Island on 17 Pro, home indicator, and passes insets to `SafeAreaProvider initialMetrics`. `BrowserFrame` draws a minimal browser bar with the URL.
- [ ] **Step 3:** App preview: theme → `AppearanceProvider` preference; textSize → `PixelRatio.getFontScale` shim and `MaterialProvider` font scale; motion/transparency → the app's accessibility hooks.
- [ ] **Step 4:** Render check passes with `--globals theme:dark` and `textSize:2`.
- [ ] **Step 5: Commit and merge.**

### Task 7: Current stories for every app screen

**Files:**
- Create: `design-system/app/mocks/expo-router.tsx` (useRouter, useLocalSearchParams, usePathname, useSegments, Link, Redirect, Stack, Tabs, router), `design-system/app/src/current/*.stories.tsx`, `design-system/app/src/StoryApp.tsx` (fixture session provider)
- Modify: `apps/mobile/src/session/SessionProvider.tsx` (export `SessionContext`), `apps/mobile/src/billing/BillingProvider.tsx` (export its context) — no behaviour change

- [ ] **Step 1:** Alias `expo-router` to the mock in the app Storybook.
- [ ] **Step 2:** `StoryApp` provides a `SessionContext` value with a fixture account and `createFoundkeepClient({ getToken: async () => 'story', fetcher: appFetcher })`, plus the billing context.
- [ ] **Step 3:** Stories under `App / Current / <flow>`: Sign-in (sign-in, register, recovery code, recover), Onboarding, Library (collection; filtered; empty; loading), Save detail (one per kind), Saved together (batch), New note, You (settings), Plans (subscription), Dock.
- [ ] **Step 4:** Render check (light, dark, 200%) passes; screenshot each and look.
- [ ] **Step 5:** `apps/mobile` typecheck and `npm test` pass.
- [ ] **Step 6: Commit and merge.**

### Task 8: Current stories for every dashboard page

**Files:**
- Create: `design-system/dashboard/src/StoryShell.tsx` (DashboardShell with fixture `me`), `design-system/dashboard/src/current/*.stories.tsx`

- [ ] **Step 1:** Preview calls `installDashboardFetch()`.
- [ ] **Step 2:** Stories under `Dashboard / Current / <flow>`: Sign-in (login, signup, recover, connect, open, beta), Library (Dashboard with fixture page; empty; error), Save detail (DetailPanel per kind; full page), Collections (list; one collection), Public (discover; collection page), Mind map, Agents, Apps & devices, Plans, Settings (account, capture, processing).
- [ ] **Step 3:** Render check (light, dark, laptop and phone) passes; screenshot and look.
- [ ] **Step 4:** Site typecheck passes.
- [ ] **Step 5: Commit and merge.**

### Task 9: Flow maps

**Files:**
- Create: `design-system/app/src/FlowMap.stories.tsx`, `design-system/dashboard/src/FlowMap.stories.tsx`, `design-system/simulator/flow-map.tsx`

- [ ] **Step 1:** `flow-map.tsx` renders columns of scaled live thumbnails (iframes of story ids at 0.3 scale) with arrows between steps, from a flow list `{ title, steps: [{ label, current: storyId, proposal?: storyId }] }`, and a Current / Proposal switch.
- [ ] **Step 2:** One map per product covering every story from Tasks 7–8.
- [ ] **Step 3: Verify, commit and merge.**

### Task 10: Live demo

**Files:**
- Create: `deploy/demo/gateway.mjs`, `deploy/demo/seed.mjs`, `deploy/demo/README.md`, user units `foundkeep-demo-backend`, `foundkeep-demo-site`, `foundkeep-demo-gateway`
- Create: `design-system/app/src/Live.stories.tsx`, `design-system/dashboard/src/Live.stories.tsx`
- Modify: `~/personal/CLAUDE.md` (ports 8817–8819)

- [ ] **Step 1:** Backend on 8817 (`ATLAS_DATA_DIR=~/.local/share/foundkeep-demo`, `ATLAS_CUSTOMER_ORIGINS=<gateway public origin>`); Next on 8819 (`FOUNDKEEP_BACKEND_URL=http://127.0.0.1:8817`, production build in `~/.local/share/foundkeep-demo/site`).
- [ ] **Step 2:** Gateway on 8818: `/app/*` serves the Expo web export (built with `baseUrl /app`), injecting a script into its `index.html` that rewrites `https://foundkeep.app` and `https://dev.foundkeep.app` fetches to `location.origin`; everything else proxies to 8819. Adds `Content-Security-Policy: frame-ancestors <storybook origin>` and removes `X-Frame-Options`.
- [ ] **Step 3:** `seed.mjs` signs in (or registers once) the demo account and replaces its library with the sample world through the API.
- [ ] **Step 4:** Live stories frame the gateway (`/app/` in a phone frame, `/dashboard` in a browser frame) with a note that the web app is not iOS.
- [ ] **Step 5:** Smoke: live app and dashboard load in frames, sign in with the demo account, open a save.
- [ ] **Step 6: Commit and merge.**

### Task 11: Wrap up

- [ ] Welcome page describes the three sections and the simulator; roadmap P5.18/P5.19 notes; memory updated; final merge and push; report to Pritam with the links.
