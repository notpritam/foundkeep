# Atlas

<!-- impeccable:product-schema 1 -->

## Platform
web

## Purpose and operating context
Atlas is a Chrome extension for deliberately saving screenshots, highlights, bookmarks, images, tweets and notes, and optionally letting an external agent act on one explicitly enabled browser tab. A local searchable library retains the captured source context. The existing platform is native HTML/CSS/JavaScript with a Manifest V3 service worker; backend and MCP bridge already exist.

## Capabilities and constraints
Captures remain in IndexedDB in this browser. Search is keyword-based, with type, tag and category filters. Optional enrichment calls a configured companion for OCR, summaries and tags. Claude Code may use remote model services even if the companion runs locally. Browser control uses a local bridge or a token-authenticated hosted relay; enabling control permits page context and actions to transit that connection. Only one tab is granted at a time.

Preserve existing database, settings keys, keyboard shortcuts, capture actions, extension key and control protocol. No additional permissions. No invented integrated cloud sync, semantic search, pricing, reviews or Web Store availability. Manual ZIP installation remains supported.

## Confirmed brand commitment
The user selected Atlas Studio (option 04) combined with Operator (option 02): bold, visually creative capture story plus clear external-agent control and visible permission states. The product is being rethought across landing, popup, library and settings. The user then clarified: do not focus on the agent part. Capture, collecting and retrieval lead; existing browser control remains secondary and unchanged.

## Scope decision
No agent chat, new permission workflow or control-worker changes. Existing control remains available through its existing setup; no new permissions.

## Evidence
Prior review and five approved-choice concepts are in `../atlas-landing-2026-09-06/`. Current code and browser-harness captures establish functionality. Demo data must be labeled and isolated from user data.
