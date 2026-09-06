# Atlas

<!-- impeccable:product-schema 1 -->

## Platform
web

## Purpose and operating context
Atlas is a customer capture product: save screenshots, highlights, bookmarks, images, tweets and notes, then find them in a private library. Native HTML/CSS/JavaScript, Chrome Manifest V3 extension, Bun/Hono/SQLite backend.

## Capabilities and constraints
Customers create an email/password account, save a recovery code, install and connect the extension. New captures save locally first and automatically upload to that account. Durable retries retain account ownership. Existing local captures require explicit import consent. Website sessions and extension credentials are separate and revocable. Every customer query and image is owner scoped; legacy backend tables/APIs remain separate.

Hosted organization provides extractive summaries, topic tags and English OCR using a bounded local processor. No customer agent setup is required. No semantic search, conversational assistant or email reset delivery is claimed. Search is keyword based. Local-only capture remains available. Cloud/local deletion are separate. Quotas are 1000 captures and 200 MiB per account.

Preserve the existing IndexedDB database, saved records, keyboard shortcuts and signed extension key. Remove customer browser-control overlays, debugger permission and relay/token setup. Never silently upload local history or transfer a pending capture to a different account.

## Confirmed brand commitment
The user selected Atlas Studio (option04) combined with Operator (option02), then asked to avoid agent focus. Studio supplies the creative visual identity; Operator supplies useful, clear product controls. Capture, collecting and retrieval lead.

## Current scope
The user explicitly requested a customer-facing extension/dashboard where customers create an account, set up the extension and captures flow automatically, extending the earlier approved redesign/launch. Deliver the account service, hosted dashboard, extension pairing/sync, truthful landing/privacy, and launch verification. Google sign-in is not assumed. Chrome Web Store publication depends on a publisher account and actual store approval; manual ZIP setup remains truthfully labeled until available.

## Evidence
Implementation contract: docs/superpowers/plans/2026-09-06-customer-cloud.md. Customer backend security tests, extension queue tests and real Chromium signup/pair/capture/dashboard tests establish functionality. Synthetic demo content stays isolated from real accounts.
