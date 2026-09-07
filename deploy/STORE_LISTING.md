# Foundkeep — Chrome Web Store submission

Build with `bash deploy/pack-store.sh`, then upload `deploy/dist/foundkeep-store-1.0.0.zip` in the Chrome Web Store developer dashboard. Google publisher access and review are required; creating this archive does not publish it.

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

- `activeTab`, `scripting`: read or capture the active page after an explicit customer action. Full-page screenshots scroll and stitch the page.
- `<all_urls>` host access: support capture actions on eligible sites and upload connected captures to Foundkeep.
- `storage`: protect account connection state, preference cache, and durable upload queue.
- `contextMenus`: provide explicit right-click save actions for text, pages, links, and images.
- `alarms`: retry pending uploads and refresh account preferences.
- External messaging: only the exact Foundkeep and temporary legacy migration origins can detect, pair, or refresh the extension. Pairing uses a short-lived, one-use code. Browser credentials are never exposed to the page.

The customer extension has no debugger permission, browser-control overlay, advertising, data sale, or cross-site behavior tracking.

### Privacy-tab answers

**Single purpose:** Save web content that the customer explicitly chooses into a private local library and, when the customer connects a Foundkeep account, sync those chosen captures to their private dashboard.

**Permission justifications:**

- `activeTab`: Temporarily access the current page only after the customer invokes Foundkeep so it can read source details and capture visible pixels. It also permits screenshots of eligible pages that persistent host access cannot reach.
- `scripting`: Run the bundled readable-text, metadata and region-selection code in the active page after a customer capture action.
- `contextMenus`: Offer explicit right-click actions for saving the selected text, page, link or image and taking a screenshot.
- `storage`: Keep protected account connection state and an account-bound preference cache. Capture content itself is stored in extension IndexedDB.
- `alarms`: Retry customer-selected cloud uploads and refresh account preferences after browser restarts or temporary network failures.
- `<all_urls>`: Let explicit capture actions work on arbitrary eligible web pages and retrieve the original file for an image the customer selects, including images hosted on a different domain from the page. Foundkeep does not read pages in the background or collect general browsing history. Chrome still blocks protected browser pages.
- External messaging: Let only `https://foundkeep.app` and the temporary exact legacy migration origin detect, pair or refresh Foundkeep. Pairing uses a short-lived one-use code, and pages cannot read extension credentials.

**Remote code:** Select **No, I am not using remote code**. The package executes only bundled JavaScript. Network requests carry customer account, preference and capture data; they never load executable code.

**User-data disclosures:**

- Personally identifiable information: account name and email when the customer chooses to connect.
- Authentication information: a Foundkeep browser connection credential stored in trusted extension storage and sent only to Foundkeep over HTTPS.
- Web history: the URL, title and source metadata of a page only when the customer explicitly saves or captures it.
- Website content: customer-selected readable page text, screenshots, images, highlights and notes.
- Do not select financial/payment, health, location or general user-activity tracking; Foundkeep does not collect them.

Certify all Limited Use statements. Privacy policy URL: `https://foundkeep.app/privacy.html`.

## Data-use disclosure

The cloud product processes account name/email, capture preferences, customer-saved page content, screenshots/images, selected text, notes, readable article text, source provenance, and page metadata only to provide the requested private library and organization features. Customers choose each capture and whether to connect cloud sync. Review the live privacy policy against the submitted build when completing Google's data-use form.

## Distribution and reviewer instructions

- Visibility: **Public**.
- Pricing: **Free**.
- Regions: all supported Chrome Web Store regions.
- Publishing: publish automatically after review approval.
- Test instructions: No pre-created credential is required. Install the extension, open any ordinary HTTPS article, click Foundkeep, choose **Save page**, then choose **Open library** to verify the local flow. To verify cloud sync, create a temporary account at `https://foundkeep.app/auth.html?mode=signup` (no email verification is required), save the shown recovery code, continue to the dashboard, choose **Connect Foundkeep**, and approve the one-use connection. Save another page and open the dashboard to see the synced capture and its source record. The reviewer can delete the temporary account from Account settings.

## Submission assets and verification

- Icon: `apps/extension/icons/icon128.png`
- Popup: `deploy/dist/store-assets/extension-popup.png`
- Dashboard: `deploy/dist/store-assets/customer-dashboard.png`
- Browser setup: `deploy/dist/store-assets/customer-browser-setup.png`
- Small promo tile: `deploy/dist/store-assets/promo-small.png`
- Marquee promo tile: `deploy/dist/store-assets/promo-marquee.png` (optional)
- Verify the archive reports version `1.0.0` and contains no `.pem`, `.key`, `key`, `update_url`, browser-control, agent, relay, companion, or development-only files.
- Test signup, pairing, readable-page capture, sync, provenance, preference refresh, export, revoke, and deletion from the final store build after its assigned ID is allowed.

Until Google approves the listing, public onboarding must continue to label the ZIP as a manual Developer mode installation.
