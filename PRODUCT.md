# Foundkeep

<!-- impeccable:product-schema 1 -->

## Platform

Web dashboard and Chromium browser extension.

## Purpose and operating context

Foundkeep is a customer capture product for saving readable pages, screenshots, highlights, bookmarks, images, posts on X, and notes with traceable source records, then finding them in a private library. It uses native HTML/CSS/JavaScript, a Chromium Manifest V3 extension, and a Bun/Hono/SQLite backend.

## Customer flow

Customers create an email/password account, save a recovery code, install the extension, and connect the browser from the dashboard. New captures save locally first and upload to that account when automatic sync is enabled. Existing local captures require explicit import consent. Website sessions and extension credentials are separate and revocable.

Each customer controls capture methods, readable bookmark extraction, page metadata, note source attachment, popup order, recent items, context menus, sync, OCR, summaries, tags, and success feedback from the dashboard. Preference changes do not require an extension release. Manifest permissions and executable features still do.

Every capture can retain the visited URL, canonical URL, title, description, site, authors, publication and modification dates, language, lead image, favicon, target URL, headings, capture method, capture and extraction times, extractor version, extraction status, and a content fingerprint. Raw page HTML is not stored.

## Security and compatibility

Customer queries, images, preferences, and credentials are owner scoped. Local IndexedDB, existing records, the fixed extension ID, signing key, shortcuts, storage keys, message kinds, API routes, database tables, and header names remain compatible across the Foundkeep migration.

The primary origin is `https://foundkeep.app`. `https://atlas.notpritam.in` remains a temporary compatibility origin for version 1.5 clients. Cross-domain website cookies cannot migrate, so existing customers sign in once on Foundkeep; their accounts and captures remain in the same database.

There is no customer agent setup, semantic-search claim, conversational assistant, advertising tracker, or email reset delivery. Search is keyword based. Local capture remains available without an account. Cloud and local deletion are separate. Quotas are 1,000 captures and 200 MiB per account.

## Evidence

The executable contract is in `docs/superpowers/specs/2026-09-07-foundkeep-launch-design.md`. Backend, extension, landing, and real Chromium customer-flow tests establish account security, data ownership, capture provenance, preference control, responsive UI, and upgrade compatibility.
