# Foundkeep extension 1.0.1 release audit

Prepared 12 September 2026. This is the update to existing Chrome item `cficnecbdbiddngllpfbacabgbcjinmk`; the archive is prepared, not submitted to Google by this task.

## Customer changes

- Cloud collection sidebar with search, recent ordering, folders/tags, list/gallery, note creation and save editing.
- Current-browser bookmark import with optional permission, plus HTML exports from other browsers. Immutable account-bound chunks resume after temporary failures; duplicates preserve manual edits and retain import provenance.
- Dashboard Free/Pro settings, scoped MCP connections, revocation and owner instructions. These live on Foundkeep's backend and website, not as remote executable extension code.

## Verification

59 extension tests pass. An installed Chromium test signs up a disposable account, pairs the real service worker, changes preferences, captures readable page content, a highlight and a screenshot, imports a nested HTML export through the sidebar, reloads the collection, verifies original timestamps/folders/provenance, revokes the connection and confirms the local copy survives. Test accounts are removed.

The installed test found and fixed a dynamic import that Chromium rejects in service workers; the sidebar API module now uses a static packaged import. Spoofed senders, arbitrary paths/origins, account changes during requests, denied bookmark permission and bounded import chunks have regression coverage.

The backend has 181 passing tests, including ownership, quotas, migration compatibility, MCP SDK interoperability, processing consent/cancellation, file bounds and billing races. Type checks pass for web/backend/mobile. The production Next build passes. Public-domain account/MCP tests pass without browser runtime or hydration errors after adding `Cache-Control: no-transform` to private HTML.

## Package and permissions

Chrome Store version 1.0.1; source/self-hosted version 1.7.0. Store packaging strips signing/update fields and includes only the allowlisted customer extension files. The manifest description remains within 132 characters.

New permissions are required `sidePanel` and optional `bookmarks`. The latter is requested only by the explicit import action. No browser bookmark is edited or deleted. Existing activeTab/scripting/contextMenus/storage/alarms, exact Foundkeep origins and optional selected-image origins retain their single-purpose uses.

The HTML import path is verified in an installed browser. Granting the real native optional-permission prompt still requires a manual browser check; automated UI tests verify the denial path and browser-tree parsing. A store-approved binary and browser support determine side-panel availability; unsupported clients use a packaged tab.

## External release steps

Upload `foundkeep-store-1.0.1.zip` to the existing Google item, update the new permission/data disclosures, and follow `deploy/STORE_REVIEWER_GUIDE.md`. Google publisher access/review is required. Preserve the existing private reviewer credential; no credential is included in this repository or submission ZIP.

Managed OpenAI processing and paid checkout remain disabled until operator credentials, RevenueCat/Apple products and provider webhooks are configured. Provider mocks validate the flow; live AI and sandbox payments have not been verified. The iPhone RevenueCat SDK requires a separate native build; compatible future UI updates can use its EAS fingerprint runtime.
