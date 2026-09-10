---
version: 1
slug: "auth-html"
primary_target: "auth.html"
related_targets: ["auth.js", "oauth.js", "customer.css"]
---

# Foundkeep Social sign-in

## Scope and mode

Operate mode for `apps/web/auth.html`. Targets are relative to the web app. Root DESIGN.md owns shared tokens; native mobile and extension are outside this visual boundary.

## Audience and job

Create or return to a private collection with an enabled provider. Google and Apple lead, followed by a native Continue with email disclosure. Recovery and provider completion errors remain visible. Existing password-only collections need ownership proof before their first provider link.

## Direction and responsive behavior

A rounded scenic welcome panel sits beside a focused white form. Clarity City headings and azure controls connect it to the landing. A translucent scenic note supplies context without competing with sign-in. Below 680px the scene becomes a compact masthead. Email controls stay usable when providers are unavailable.

## Verification and constraints

Captured at 1440px and 390px with overflow checks at 320px. Use native focus, controls, announcements and reduced motion. The recorded review covers supplied viewports; it is not an exhaustive accessibility audit. Evidence: `docs/design/scenic-customer-web/verification.md`. Do not invent availability, user metrics, or unsupported account behavior.
