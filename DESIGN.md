---
name: Foundkeep
description: A shared bookmark identity with distinct marketing, web product, and mobile surfaces.
colors:
  landing-blue: "#086ca8"
  landing-blue-hover: "#075888"
  landing-scenic-blue: "#0577b9"
  landing-sky: "#e0f0fc"
  landing-mint: "#d5f8cf"
  landing-white: "#ffffff"
  landing-ground: "#f1f4f4"
  landing-ink: "#182b30"
  landing-muted: "#596a6e"
  landing-line: "#dfe8e9"
---

# Foundkeep Design System

## Overview

The marketing landing follows the user's scenic reference: an azure mountain horizon, spacious white ground, rounded sky and mint product panels, soft glass mini-controls, and scenic closing sections. The tokens above apply **only to the landing**; [its surface brief](apps/web/.impeccable/surfaces/index-html.md) records the page contract.

Website auth, dashboard, support, and browser extension retain their existing themes and direct controls. The iPhone app retains the approved deep-purple gallery and floating dock. Marketing illustrations do not replace those product designs.

The canonical mark remains a source point inside a folded bookmark and protected dark frame: a saved item whose origin stays attached. Preserve its geometry from small extension icons through social artwork.

## Colors

Landing blue drives actions and links; scenic blue backs the mountain imagery. Sky and mint alternate behind product illustrations. White carries the reading surface; dark teal ink, muted gray-teal copy, and pale rules maintain hierarchy. Translucent blue glass and darker image overlays protect white text. Values come from the actual controls in [landing.css](apps/web/landing.css).

Existing web and extension guidance remains warm paper (`#f3f3f0`), near-black (`#171917`), vermilion (`#c63b23`), and muted moss (`#6b7553`), with distinguishable semantic success and error colors. Preserve each route's incumbent theme and the mobile app's existing deep-purple palette.

## Typography

Self-hosted Clarity City and Geist connect the surfaces. The landing loads Clarity City Medium/Semibold and variable Geist with font swapping. Its centered hero uses weight 500, `clamp(46px, 5.6vw, 80px)`, 1.02 line height, and tight tracking. Left-aligned section titles use `clamp(34px, 3.9vw, 53px)` with 1.08 line height. Geist carries body text and controls; base body text is 15px/1.6, with paragraphs capped at 68 characters. Preserve the existing Clarity City Bold/Semibold, Geist, and restrained fixed-size product controls outside the landing.

## Layout

The landing has a white shell capped at 1600px, main content capped at 1100px, and generous section gaps (116px by default). Desktop capture and setup panels are paired, the collection has three examples, and platforms use two columns. Breakpoints at 1100px, 800px, and 540px progressively reduce gutters and stack content; the surface brief specifies 1440px, 768px, 390px, and 320px behavior.

`index.html` loads separate `landing.css` to prevent marketing styles from bleeding into other surfaces. Auth and dashboard retain `styles.css` and `customer.css`; support retains `styles.css`. Keep landing tokens and broad panel shapes isolated there.

## Elevation & Depth

Landscape imagery and tonal layering carry depth. Platform cards use a soft shadow (`0 8px 24px #1b476013`) and fine border; mini-windows and stickers overlap with small static rotations. Hero glass combines translucent fills, light borders, and restrained backdrop blur. The closing CTA and footer reuse local mountain imagery with readable white text over darker overlays.

## Shapes

Landing actions are pills; mini-controls are circles. Broad scenic corners (27px hero), nested platform corners (23px card, 17px art), and smaller demo/collection corners establish hierarchy. Existing product guidance retains compact action radii (6px), panels (12px), and sparse 1px borders.

## Components

Landing actions are blue on white and white over scenery, with a glass secondary hero action. The highlight demo exposes saved/reset states, item count, source label, and an announced status explaining that the real library is unchanged. The collection is visibly labeled illustrative; the actual browser-library screenshot sits behind a native details disclosure. Decorative platform diagrams are hidden from assistive technology and accompanied by accurate feature and beta text.

The extension still leads with Save page, configurable secondary captures, a compact note composer, and a fixed Open library footer inside Chromium's 600px popup limit. Libraries retain search, filters, readable cards, provenance, account controls, and explicit local/sync, empty, and error states.

Preserve keyboard navigation, visible focus, semantic headings, native disclosures, and the skip link. Landing motion uses short scenic and saved-card arrivals plus gentle hover lifts; reduced motion disables animations, transitions, and smooth scrolling. Core content and navigation remain available without JavaScript.

## Do's and Don'ts

Preserve the scenic direction only on the landing and retain the approved themes elsewhere. Keep the bookmark mark unchanged; do not add gradients, sparkles, orbit symbols, religious imagery, or generic cloud/magnifying-glass substitutions to it.

The Chrome Web Store listing is live; iPhone access is TestFlight beta. Retain demo/collection disclosures, the actual browser screenshot, support, legal, and manual installation links. Do not invent App Store availability, Android/native desktop apps, pricing, metrics, testimonials, tracking, or unsupported claims. Customer setup asks for an account and browser connection, never developer tokens, relay configuration, or an agent.
