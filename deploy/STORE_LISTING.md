# Foundkeep — Chrome Web Store submission

Build with `bash deploy/pack-store.sh`, then upload `deploy/dist/foundkeep-store-1.0.0.zip` in the Chrome Web Store developer dashboard. Google publisher access and review are required; creating this archive does not publish it.

The store archive removes the self-hosted `key` and `update_url`. Google assigned Store extension ID `cficnecbdbiddngllpfbacabgbcjinmk`; it is allowed by the dashboard and backend alongside the established self-hosted ID during migration. Keep `storeUrl` unset until the approved listing is publicly installable, then use its final public Chrome Web Store URL.

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

**Privacy policy:** https://foundkeep.app/privacy
**Support:** https://foundkeep.app/support

## Single purpose and permissions

Foundkeep's single purpose is saving customer-selected web content into a private local or connected library so it can be found and used again.

- `activeTab`, `scripting`: read or capture the active page after an explicit customer action. Full-page screenshots scroll and stitch the page.
- `https://foundkeep.app/*` host access: load account preferences, operator policy, and sync only customer-selected captures with Foundkeep.
- Optional HTTP(S) host access: requested only for the selected image's exact origin when the customer invokes **Save image**, so Foundkeep can retrieve the original file without permanent all-sites access.
- `storage`: protect account connection state, preference cache, and durable upload queue.
- `contextMenus`: provide explicit right-click save actions for text, pages, links, and images.
- `sidePanel`: Display the customer’s private collection beside the current web page so they can search, browse folders and tags, save and edit items without switching to the dashboard.
- Optional `bookmarks`: Read the current browser’s bookmark tree only after the customer chooses Import and grants access. Preserve available URLs, titles, folders and dates in their Foundkeep account. Foundkeep never changes or deletes browser bookmarks.
- `alarms`: retry pending uploads and refresh account preferences.
- External messaging: only the exact Foundkeep and temporary legacy migration origins can detect, pair, or refresh the extension. Pairing uses a short-lived, one-use code. Browser credentials are never exposed to the page.

The customer extension has no debugger permission, browser-control overlay, advertising, data sale, or cross-site behavior tracking.

### Privacy-tab answers

**Single purpose:** Foundkeep saves web content that the customer explicitly chooses—readable pages, screenshots, highlighted text, links, images, posts and notes—into a private local library and, when the customer connects an account, syncs those chosen captures to their private Foundkeep dashboard for search and retrieval.

**Permission justifications:**

- `activeTab`: Temporarily access the active tab only after the customer invokes Foundkeep. This lets the extension read source metadata and selected content, capture visible pixels, and start a region or full-page screenshot on eligible pages.
- `scripting`: Inject Foundkeep's bundled capture code into the active tab only after the customer chooses a capture action. It extracts readable text and metadata or provides the region-selection interface.
- `contextMenus`: Offer explicit right-click actions for saving selected text, the current page, a link or an image, and for taking a screenshot.
- `storage`: Store the Foundkeep account connection credential, data-only preferences and policy caches, and durable upload-queue state. Capture content is stored separately in extension IndexedDB.
- `sidePanel`: Display the customer’s private collection beside the current web page so they can search, browse folders and tags, save and edit items without switching to the dashboard.
- Optional `bookmarks`: Read the current browser’s bookmark tree only after the customer chooses Import and grants access. Preserve available URLs, titles, folders and dates in their Foundkeep account. Foundkeep never changes or deletes browser bookmarks.
- `alarms`: Retry customer-selected cloud uploads and refresh account preferences after browser restarts or temporary network failures.
- Host permissions: Use `https://foundkeep.app/*` to connect the browser to the customer's account, receive data-only preferences and policy, and sync selected captures. On `x.com` and `twitter.com`, a bundled content script adds a Foundkeep save button and extracts a post only when the customer clicks it. Optional HTTP(S) access is requested only for the exact origin of an image the customer chooses to save so the original file can be fetched. Foundkeep does not read general browsing activity in the background or load remote code.
- Optional HTTP(S) hosts: Request access to the selected image's exact origin only after the customer chooses **Save image**. This is needed when the image lives on a different origin from its page. Foundkeep does not request permanent access to unrelated sites, read pages in the background, or collect general browsing history.
- External messaging: Let only `https://foundkeep.app` and the temporary exact legacy migration origin detect, pair or refresh Foundkeep. Pairing uses a short-lived one-use code, and pages cannot read extension credentials.

**Remote code:** Select **No, I am not using remote code**. If the justification field remains visible, paste: Foundkeep executes only JavaScript and assets included in the submitted extension package. It fetches JSON account preferences and a validated data-only runtime policy from foundkeep.app and uploads customer-selected captures; no response is evaluated or executed as code.

**User-data disclosures:**

- Select **Personally identifiable information**: account name and email when the customer chooses to connect.
- Select **Authentication information**: a Foundkeep browser connection credential stored in extension storage and sent only to Foundkeep over HTTPS.
- Select **Location**: the request IP address is used only in a short-lived in-memory rate-limit key to protect account and upload endpoints. Foundkeep does not request device location.
- Select **Web history**: the URL, title and source metadata of a page only when the customer explicitly saves or captures it.
- Select **Website content**: customer-selected readable page text, screenshots, images, highlights and notes.
- Do not select financial/payment information, health information, personal communications or user activity; Foundkeep does not collect them as separate data categories or monitor browsing behavior.

Certify all Limited Use statements. Privacy policy URL: `https://foundkeep.app/privacy`.

## Data-use disclosure

The cloud product processes account name/email, capture preferences, customer-saved page content, screenshots/images, selected text, notes, readable article text, source provenance, and page metadata only to provide the requested private library and organization features. Customers choose each capture and whether to connect cloud sync. Review the live privacy policy against the submitted build when completing Google's data-use form.

## Distribution and reviewer instructions

- Visibility: **Public**.
- Pricing: **Free**.
- Regions: all supported Chrome Web Store regions.
- Publishing: publish automatically after review approval.
- Test instructions: use the dedicated reviewer credential from the private release artifact. Install the extension, sign in at `https://foundkeep.app/auth.html?mode=login`, choose **Connect this browser**, then open any ordinary HTTP(S) article and choose **Save page**. Open the dashboard to verify the synced capture, stored article details and original-source record. The pre-seeded account contains three harmless samples and no administrative access.

## Submission assets and verification

- Icon: `apps/extension/icons/icon128.png`
- Popup: `deploy/dist/store-assets/extension-popup.png`
- Dashboard: `deploy/dist/store-assets/customer-dashboard.png`
- Browser setup: `deploy/dist/store-assets/customer-browser-setup.png`
- Small promo tile: `deploy/dist/store-assets/promo-small.png`
- Marquee promo tile: `deploy/dist/store-assets/promo-marquee.png` (optional)
- Verify the archive reports version `1.0.0` and contains no `.pem`, `.key`, `key`, `update_url`, browser-control, agent, relay, companion, or development-only files.
- Test signup, pairing, readable-page capture, sync, provenance, preference refresh, export, revoke, and deletion from the final store build after its assigned ID is allowed.
- Paste the dedicated account from the private `REVIEWER-CREDENTIALS-1.0.0.md` launch artifact into **Test instructions**; follow `deploy/STORE_REVIEWER_GUIDE.md` for the exact review path.
- Keep executable changes on the reviewed store channel. Foundkeep fetches validated JSON preferences only and never downloads or executes remote code; see `docs/extension-configuration-and-updates.md`.

Until Google approves the listing, public onboarding must continue to label the ZIP as a manual Developer mode installation.
