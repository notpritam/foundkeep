# Foundkeep — Chrome Web Store submission

Build with `bash deploy/pack-store.sh`, then upload `deploy/dist/foundkeep-store-1.6.0.zip` in the Chrome Web Store developer dashboard. Google publisher access and review are required; creating this archive does not publish it.

The store archive removes the self-hosted `key` and `update_url`. Once Google assigns an ID, add it to `apps/web/customer-config.json` and `ATLAS_CUSTOMER_EXTENSION_IDS`. Keep the established self-hosted ID allowed during migration. Set `storeUrl` only after the approved listing is publicly installable.

## Listing

**Name:** Foundkeep — Save what matters

**Category:** Productivity
**Language:** English

**Short description:**

> Save readable pages, screenshots, highlights and notes with their original source in a private, searchable library.

**Description:**

Foundkeep gives the good things you find on the web a place to stay.

- Save a readable page copy with its original source.
- Capture a region or full page, keep highlighted text, save a link or image, and write quick notes.
- Create a Foundkeep account and connect the browser from the dashboard.
- Save locally first and sync new captures to a private online library when automatic sync is enabled.
- Search and filter your library and open the original source record for a saved page.
- Control capture methods, page details, popup layout, context menus, sync, OCR, summaries, and tags without reinstalling.
- Keep offline saves on the device until a connection is available.
- Export cloud captures, revoke connected browsers, change the password, or delete the account from settings.

An account is optional for local capture. Existing local captures stay on the device unless the customer explicitly imports them. Local and cloud copies are separate.

Saved pages can include readable text, headings, visited and canonical URLs, title, description, publisher, author, publication and modification dates, language, lead image, favicon, capture method, timestamps, extraction status, and a content fingerprint. Foundkeep does not store raw page HTML.

Cloud accounts include up to 1,000 captures and 200 MiB of content. Customers save a one-time recovery code because Foundkeep does not send password-reset email. English screenshot text recognition is available when OCR is enabled.

**Homepage:** https://foundkeep.app

**Privacy policy:** https://foundkeep.app/privacy.html
**Support:** https://github.com/notpritam/foundkeep/issues

## Single purpose and permissions

Foundkeep's single purpose is saving customer-selected web content into a private local or connected library so it can be found and used again.

- `activeTab`, `tabs`, `scripting`: read or capture the active page after an explicit customer action. Full-page screenshots scroll and stitch the page.
- `<all_urls>` host access: support capture actions on eligible sites and upload connected captures to Foundkeep.
- `storage`: protect account connection state, preference cache, and durable upload queue.
- `contextMenus`: provide explicit right-click save actions for text, pages, links, and images.
- `alarms`: retry pending uploads and refresh account preferences.
- External messaging: only the exact Foundkeep and temporary legacy migration origins can detect, pair, or refresh the extension. Pairing uses a short-lived, one-use code. Browser credentials are never exposed to the page.

The customer extension has no debugger permission, browser-control overlay, advertising, data sale, or cross-site behavior tracking.

## Data-use disclosure

The cloud product processes account name/email, capture preferences, customer-saved page content, screenshots/images, selected text, notes, readable article text, source provenance, and page metadata only to provide the requested private library and organization features. Customers choose each capture and whether to connect cloud sync. Review the live privacy policy against the submitted build when completing Google's data-use form.

## Submission assets and verification

- Icon: `apps/extension/icons/icon128.png`
- Popup: `apps/web/assets/extension-popup.png`
- Dashboard: `deploy/dist/store-assets/customer-dashboard.png`
- Browser setup: `deploy/dist/store-assets/customer-browser-setup.png`
- Verify the archive contains no `.pem`, `.key`, `key`, `update_url`, `control-bg.js`, or `agent-control.js`.
- Test signup, pairing, readable-page capture, sync, provenance, preference refresh, export, revoke, and deletion from the final store build after its assigned ID is allowed.

Until Google approves the listing, public onboarding must continue to label the ZIP as a manual Developer mode installation.
