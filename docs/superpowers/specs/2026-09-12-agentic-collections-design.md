# Foundkeep imports, sidebar, and agentic collections

The user approved this scope on September 12, 2026. Implementation proceeds in order: import, extension sidebar, hosted processing, customer MCP, then Pro billing and advanced processing. This extends the existing private customer library; the historical local Atlas agent and browser-control relay do not gain customer-account access.

## Import and extension

Customers can read the current Chromium browser's bookmark tree after granting the optional bookmarks permission, or upload a Netscape bookmark HTML export from Chrome, Edge, Brave, Firefox, Safari, or Raindrop. Import never modifies browser bookmarks. A preview shows bookmark/folder counts, rejected entries, duplicates, and remaining capacity. Commit runs in bounded, idempotent chunks with account-bound progress that survives popup closure and service-worker suspension.

Preserve folder hierarchy, original URLs, titles, dates, descriptions, and tags where supplied. Duplicate URLs do not create another save or overwrite customer edits; additional import provenance remains traceable. Import supports explicit retry after interruption. Account switches pause the import instead of assigning it to the new account.

The sidebar is a packaged extension page: a compact brand/search/save header; All, Unfiled, Recent, folders, and tags; a dense list with previews; and an inline detail/editor. Popup actions remain quick and open the sidebar through a user gesture. Credentials remain inside the background module. Unsupported side-panel APIs fall back to the same packaged library in a tab. All executable code ships in the extension package. Sidebar permission and optional bookmark permission require one reviewed extension update. iPhone version remains 1.0.0; the Chrome Store upload must use a version newer than its published package.

## Hosted processing and access

Retain local capture, Free storage, original files, and existing basic extraction. Add a separate durable hosted-processing queue with leases, bounded retries, per-account allowance reservations, provider timeouts, structured-output validation, and an activity record. Account controls decide whether new saves receive hosted processing. Manual tags and source metadata are never replaced by model suggestions. Captured text and model responses are untrusted data; model calls have no execution tools.

Use the server-only OpenAI Responses adapter with structured outputs and default model `gpt-4.1-mini`. Operators can choose another compatible GPT model through the server environment; adding an open-model provider requires a reviewed adapter. Provider credentials, billing secrets, and provider URLs never enter extension/mobile/web bundles. Files are read only for their owner. Supported media derivatives retain the source file and use bounded native processes. Public webpage/social extraction uses the existing DNS-pinned request protection, bounded redirects, byte/time limits, and no customer browsing cookies. Inaccessible content is reported as unavailable, not fabricated.

## Customer agents

Provide a separate customer MCP endpoint and scoped, revocable agent credentials. Tools cover listing/searching and reading saves, reading owned files, folders/tags/relationships, applying organization with revision guards, requesting processing, and reading an ordered change feed. Account ownership comes from the credential. Agent credentials cannot access account passwords, provider credentials, billing secrets, or another account's data. Read-only credentials and write-enabled credentials are separate choices.

A customer can nudge an agent through a stored request. External agents consume changes and requests on their own runtime/schedule; MCP does not imply Foundkeep hosts arbitrary customer agent code. Configuration and an example scheduled runner document that distinction. Agent activity is inspectable and credentials can be revoked immediately.

## Plans and release

Free includes capture, organization, import, and customer MCP. Pro is USD 5/month and adds Foundkeep-hosted automation while retaining MCP. Enforce storage/capture/processing allowances server-side and expose actual remaining use. Billing uses server-created checkout and customer-portal sessions; verified, idempotent webhooks own entitlements. No client-provided plan or return URL grants paid access.

Mobile purchases and restores use RevenueCat's native SDK and App Store products. The backend maps each authenticated Foundkeep account to a stable, random RevenueCat app user ID; it is distinct from the public account UUID. This prevents another customer from guessing the purchase identity. Server-verified RevenueCat subscription events and Stripe events share the same account entitlement, retaining access if either valid subscription remains active. Native purchase state alone never grants server processing access. A new TestFlight binary is required for the SDK; the app version stays 1.0.0. The public RevenueCat SDK key is separate from secret RevenueCat server/webhook credentials.

The user authorized locating their existing OpenAI key in their Mac Electron project/Downloads configuration and transferring it privately. Stripe flow is implemented but its key will be supplied later. AI and checkout remain explicitly unavailable until their operator credentials are configured. Test provider and billing behavior with deterministic transports and isolated accounts; real provider/billing smoke checks require those credentials. Publish only verified capabilities and update privacy, support, extension permission justifications, and plan copy to match.

## References

- https://help.raindrop.io/install-extension — persistent collection/search sidebar and quick-save interaction.
- https://help.raindrop.io/import — bookmark exports and preservation of organization.
- https://developer.chrome.com/docs/extensions/reference/api/sidePanel — bundled side panel and gesture requirement.
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization — authenticated remote MCP access.
