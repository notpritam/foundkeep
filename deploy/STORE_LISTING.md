# Atlas customer extension — Chrome Web Store submission

Build: `bash deploy/pack-store.sh`. Upload `deploy/dist/atlas-store-1.4.0.zip`
to the Chrome Web Store developer dashboard. The publisher account and Google
review are required; generating this file does not publish the extension.

The store package removes `key` and `update_url`. Once assigned, add the store ID
to `apps/web/customer-config.json` and `ATLAS_CUSTOMER_EXTENSION_IDS` on the backend.
Keep the existing self-hosted ID alongside it. Set the public `storeUrl` only
after the approved listing is installable.

## Listing

Name: **Atlas — Save what matters**

Short description (under 132 characters):
> Save screenshots, highlights, links and notes. Connect your Atlas account to keep a private, searchable cloud library.

Category: Productivity. Language: English.

Description:

Atlas gives the good things you find on the web a place to stay.

- Capture a region or a full page, save highlighted text, bookmark a link, or write a quick note.
- Create an Atlas account and connect your browser in one click after installation.
- New captures save on your device first and sync automatically to your private online library.
- Search your library, filter by capture type, view original sources and collect from multiple browsers.
- Cloud text extracts, topic tags and English screenshot text recognition run automatically.
- Offline saves wait on your device and retry when a connection is available.
- Export your cloud library, revoke connected browsers, or delete your account from settings.

An account is optional for local capture. Previous local captures stay on the
device unless you explicitly choose to import them into your connected account.
Local and cloud copies are separate: deleting one does not erase the other.

Cloud accounts include up to 1,000 captures and 200 MiB of saved content.
Save the recovery code provided at signup; Atlas does not send password-reset
emails. Text recognition currently supports English. Organization produces text
extracts and topic tags; it is not a conversational assistant.

Homepage: https://atlas.notpritam.in
Privacy policy: https://atlas.notpritam.in/privacy.html
Support: https://github.com/notpritam/atlas/issues

## Single purpose and permissions

Single purpose: save web content into the customer's private local or connected
Atlas library so it can be found and used again.

- `activeTab`, `tabs`, `scripting`: capture the user-selected page and its source
  information after an explicit action. Full-page screenshots require scrolling
  and stitching the visible page.
- `<all_urls>` host access: users can choose links, images and captures on any
  eligible website; upload connected captures to Atlas. Optional local companion
  access remains for customers using advanced local organization.
- `storage`: account connection settings and the durable local upload queue.
- `contextMenus`: explicit right-click save actions for text, links and images.
- `alarms`: retry pending uploads and optional local organization.
- External messaging: only the Atlas website may detect and connect the extension
  with a short-lived, one-use pairing code. Browser credentials are never exposed
  to the webpage.

There is no browser-control debugger permission or agent control overlay in the
customer extension.

## Data disclosures for the publisher

The cloud product processes account email/name, user-saved website content,
screenshots/images, selected text, notes, source URLs and titles. These are used
to provide the requested private library and organization. The user chooses when
to capture and whether to connect cloud sync. No advertising, data sale or
cross-site behavior tracking is part of Atlas. Review the live privacy policy
against the exact submitted build when completing the store's data-use form.

## Submission assets and verification

- Icon: `apps/extension/icons/icon128.png`.
- Prepare 1280×800 screenshots of the connected popup, the cloud library, and a
  capture detail. Use a disposable QA account with synthetic content.
- Test signup → connect → capture → cloud dashboard from the final store build
  after its assigned ID has been added to the website/backend allowlists.
- Verify the archive has no `.pem`, `.key`, `key`, or `update_url` fields, and
  matches the final manifest permissions and privacy disclosures.

Do not direct ordinary customers to managed-browser force-install policies.
Until the store listing is approved, disclose the manual ZIP installation steps.
