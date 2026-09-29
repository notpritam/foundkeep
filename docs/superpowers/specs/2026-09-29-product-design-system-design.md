# App and dashboard on the design system, with a simulator — design

Date: 2026-09-29
Status: Approved in conversation (Pritam, 2026-09-29); awaiting spec review
Launch tracker: P5.18 (app), P5.19 (website and dashboard); follows P5.17 (extension)

## Goal

Decide every screen, flow and component of the FoundKeep app and dashboard by
picking between variants in Storybook, the loop that produced the extension's
dock and Add details card. The variants are **real components**, not mockups,
and a **simulator** shows any screen, and the real running app and dashboard,
in phone, tablet and desktop frames so they can be judged and tested before
anything ships.

## Decisions (from Pritam)

| Question | Decision |
|---|---|
| What the first round covers | Every flow and every screen, sign-in included, for the app **and** the dashboard. |
| What the simulator runs | **Both**: proposals in device frames, and the real app and dashboard (live, clickable) once built. |
| How proposals are made | **Real components**: React Native (rendered on the web) for the app, Next/React for the dashboard, no HTML mockups. |
| Architecture, simulator, scope and order, testing | Approved section by section as written below. |
| Out of scope | `/console` (internal admin) and the marketing pages (landing, privacy, terms, support). |

## 1. Architecture

### One Storybook, three sections

The Storybook at `omni--8814` (user service `foundkeep-storybook`) stays the
single address and becomes a hub that composes two more Storybooks:

| Section | Package | Framework | Renders |
|---|---|---|---|
| Extension | `design-system/` (existing) | `@storybook/html-vite` 10.6 | today's stories, unchanged |
| App | `design-system/app/` | `@storybook/react-native-web-vite` 10.6 | real components and screens from `apps/mobile/src` |
| Dashboard | `design-system/dashboard/` | `@storybook/nextjs-vite` 10.6 | real components and pages from `apps/site` |

Each package has its own `package.json` and `node_modules` (never the repo
root's, which is linked to another checkout). All three build statically;
the hub's build contains the other two under `/app/` and `/dashboard/` and
composes them with Storybook refs, so the existing service keeps serving
one directory. Versions checked 2026-09-29: both frameworks accept React 19,
Vite 8, React Native ≥ 0.74.5 (the app is 0.86.3), react-native-web 0.21 and
Next 16.

### One token source

`design-system/tokens.json` holds colour (light and dark), spacing, radius,
control sizes, type scale, elevation and motion. A generator writes:

- `apps/extension/src/theme.css` (the extension, today's variable names kept),
- `apps/mobile/src/palettes.json` and the scales in `apps/mobile/src/theme.ts` (the app),
- the token block of `apps/site/app/appearance.css` (the dashboard).

The accent is emerald and the dark theme is layered near-black, never pure
black and never blue. The app's azure palette goes away. A check fails if any
generated file differs from what `tokens.json` produces.

### One component vocabulary

The same names in every product, each with variants and sizes, each with
stories:

| Component | Extension (CSS) | App (`apps/mobile/src/ui/`) | Dashboard (`apps/site/components/ui/`) |
|---|---|---|---|
| Button, Tag, Badge, Select, Text field, Card, Status message | ✓ (exists) | new | new |
| Save preview, Sync status | ✓ (exists) | new | new |
| Listbox | ✓ (exists) | as Sheet | ✓ |
| Sheet (bottom sheet) | | new | |
| Tab bar | | new | |
| Sidebar, Dialog | | | new |
| Icon (the rounded 24px set) | ✓ (exists) | new | new |

The app draws icons with `@expo/vector-icons` today. Sharing the rounded set
needs `react-native-svg`, a native module, so the first app release that
uses it is a new TestFlight/Play build, not an over-the-air update.

### Real screens on sample data

`design-system/fixtures/` holds one sample world shared by both new
Storybooks: an account on each plan, folders, tags, collections (own, shared,
public), and a save of every kind (bookmark, region and full-page screenshot,
image, post on X, highlight, note, document, audio/video, a multi-item save,
an unsynced save, an archived save), with small sample images.

- **App:** stories render the existing screens unchanged inside the app's
  real providers (appearance, session, billing), with the router mocked
  and the HTTP API answered from the fixtures by a mock service worker.
- **Dashboard:** pages are server components that load data and hand it to
  client components; stories render those client components with fixture
  props, with Next's router and image mocked by the framework.

Every flow starts with a **Current** story: today's screen on the sample data.

### Proposals are real code

Variants live in `apps/mobile/src/proposals/<flow>/` and
`apps/site/components/proposals/<flow>/`, built from the shared components
and shown under `App / Proposals / <flow>` and `Dashboard / Proposals / <flow>`.
When Pritam picks one, it replaces the real screen, and that flow's proposals
folder and stories are deleted. Only approved designs remain.

**Exception: the iOS share sheet** is native Swift (`share-extension/`,
UIKit) and cannot run on the web. Its proposals are React Native stand-ins
that mirror its layout. The pick is rebuilt in Swift and verified in the iOS
simulator on the Mac.

## 2. Simulator

- **Toolbar** in the App and Dashboard sections:
  - device: iPhone 17 Pro, iPhone SE, Pixel 9, iPad, laptop 1280, desktop 1440;
  - theme: light or dark;
  - text size: 100, 135 or 200% (iOS Dynamic Type; Android font scale);
  - reduced motion and reduced transparency.
- **Phone frames** draw the status bar, Dynamic Island, home indicator and
  safe areas, which the screens must respect. Form stories get a switch that
  shows the on-screen keyboard.
- **Flow maps**, one per product: every screen as a live thumbnail in flow
  order (sign-in → onboarding → library → save detail → edit…), with a
  Current / Proposal switch. A thumbnail opens that screen in the simulator.
- **Live builds**: a Live entry opens the real app (its Expo web export) and
  the real dashboard inside the frames, clickable, against one throwaway demo
  backend.
  - The seed script creates the demo account and the fixture world. Rerunning it resets the data.
  - Ports: **8817** demo backend (loopback), **8818** demo gateway (public, via bb Connect), **8819** demo Next server (loopback). They run as user services and are registered in `~/personal/CLAUDE.md`.
  - The gateway serves the app's web export under `/app/` and proxies everything else to the demo dashboard. The app then calls the API on its own origin, with no cross-origin setup.
  - Only the demo gateway allows framing, and only by the Storybook origin.
- **Honest limit.** The web version of the phone app is close to iOS but not
  exact (fonts, blur, native sheets and the share sheet differ). The Live app
  page says so. The last check on each flow is TestFlight and the Android
  build.

## 3. Scope and order

### App flows

1. **Sign-in**: sign-in (Apple, Google, email), register, recovery code, recover, OAuth return, open link.
2. **Onboarding**: first run and the share-sheet guide.
3. **Shell**: tab bar and dock (Library, You, +), header, offline and unsynced states.
4. **Library**: search, folder, type and tag filters, and a card for every save kind. Empty, loading, error and archive.
5. **Save detail**: reader, preserved post, image viewer, note, document, related saves and actions. Also the edit-details sheet (the phone version of the extension's Add details card) and the AI processing controls.
6. **Saving**: iOS share sheet, Android share, new note, multi-item save, the + menu.
7. **You**: account, appearance, notifications, devices, processing, sign out, delete account.
8. **Plans**: the paywall.

### Dashboard flows

1. **Sign-in**: login, signup, recover, connect a device, open, beta, checkout.
2. **Shell**: sidebar, header, ⌘K search.
3. **Library**: grid, filters, cards, the drafts banner (already chosen: Storybook `Web / Planned / Drafts banner`), empty, loading, archive.
4. **Save detail**: dialog and full page, preserved source, processing, note.
5. **Collections**: yours, one collection with members and moderation, public discovery, public collection page.
6. **Mind map, Agents, Apps & devices, Plans, Settings** (account, capture, processing).

### Variants

Three per screen for the everyday flows (shell, library, save detail,
saving) and two for the rest. Each flow also keeps its Current story. Open
foundations questions are shown as variants inside the first flow, not
asked in chat. These include the platform fonts (SF/Roboto) versus Inter on
the phone and whether the mountain backdrop survives.

### Order and pipeline

1. **Foundation**: tokens, the two Storybooks and hub, simulator, fixtures, Current stories for every screen, flow maps, live builds.
2. **App**, flow by flow: shell and library → save detail → saving → You and plans → sign-in and onboarding.
3. **Dashboard**, the same way: shell and library → save detail → collections → settings, apps, agents and plans → mind map → sign-in.

When a flow's proposals are ready, Pritam hears about it and reviews it. He
comments by story name. While he reviews one flow, the previous pick is built
for real and appears in the Live simulator. Each phase gets its own
implementation plan. The first plan covers the foundation only.

## 4. Testing

- **Every story renders**: an automated pass loads every story in light and
  dark, at a phone and a desktop size, and fails on any console error. The
  accessibility check (contrast, labels, touch-target size) runs on each
  story.
- **Looked at before handover**: each flow is screenshotted and reviewed
  before Pritam is told it is ready.
- **No token drift**: the generator check above runs with the tests.
- **Real code stays green**: when a pick replaces a real screen, these must pass:
  - the app's typecheck and unit tests (`apps/mobile` `npm test`);
  - the dashboard's browser tests against a throwaway backend;
  - the extension suite.

  Tests that describe the old UI get updated, never skipped. The app's Maestro flows run on the Mac's iOS simulator for every changed flow.
- **Live smoke**: the live app and dashboard load inside the frames, sign in
  with the demo account and open a save.
- **Shipping**: the dashboard goes to dev first, then production after
  Pritam has tried it. The app ships as an Expo update or a new TestFlight
  build, whichever the change needs (the first `react-native-svg` release is
  always a build). Pritam checks it on his phone before it goes wider.

## Risks

- **React Native Web with Expo modules**: `expo-router`, `expo-glass-effect`,
  `expo-secure-store` and friends need web versions or mocks in Storybook.
  The app already exports for the web, so most of them exist. The foundation
  plan proves this first with a single screen before building on it.
- **Composed Storybooks from one static directory**: refs are expected to
  work with same-origin paths. If they need absolute URLs, the hub is built
  with the public address.
- **Dashboard pages as server components**: stories render the client
  components beneath them. Any page whose logic sits only in the server
  component gets a thin client split as part of its flow's work.
