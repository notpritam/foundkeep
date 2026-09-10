---
version: 1
slug: "dashboard-html"
primary_target: "dashboard.html"
related_targets: ["dashboard.js", "customer.css"]
---

# Foundkeep Private library

## Scope and mode

Operate mode for `apps/web/dashboard.html`. Targets are relative to the web app. Root DESIGN.md owns shared tokens; native mobile and extension are outside this visual boundary.

## Audience and job

Find saved content through search and type filters; read, save notes, connect a browser and manage account/capture settings. Preserve every owner-scoped data flow and explicit destructive confirmation.

## Apps and devices

**Apps & devices** opens two setup paths: install/connect the browser extension, or get the iPhone beta and sign in with the same account. The iPhone path includes an existing-installation app link, Share menu steps, and connection status. A dismissible contextual device suggestion keeps these paths discoverable from the library. Connected iPhone status is account scoped and comes from the server’s `clientKind`; legacy unknown mobile sessions are upgraded through `mobile/me`. Keep private TestFlight availability explicit until distribution configuration changes.

## Direction and responsive behavior

A white desktop sidebar anchors a light gallery. Notes use sky; highlights use mint; real images lead image cards. Navigation moves above the gallery on phones and filters scroll horizontally. Saved content precedes collapsed Source details. Native dialogs retain keyboard focus, source links and readable metadata.

## Verification and constraints

Captured at 1440px and 390px with overflow checks at 320px. Use native focus, controls, announcements and reduced motion. The recorded review covers supplied viewports; it is not an exhaustive accessibility audit. Evidence: `docs/design/scenic-customer-web/verification.md`. Do not invent availability, user metrics, or unsupported account behavior.
