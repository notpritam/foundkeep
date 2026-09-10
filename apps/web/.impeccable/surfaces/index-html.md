---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["landing.css", "app.js"]
---

# Foundkeep scenic landing

## Scope and mode

Persuade mode for `apps/web/index.html`. Frontmatter targets are relative to the `apps/web` project root. This brief records the implemented redesign from the user's scenic reference and [implementation brief](../../../../docs/design/scenic-landing/brief.md). Separate `landing.css` retains marketing layout rules. Customer auth, dashboard, support and policies now inherit its visual world through `customer.css`; the extension retains its theme and native mobile retains the approved deep-purple Gallery and floating dock.

## Audience and job

Help visitors understand saving discoveries with their source, then choose installation or account creation. **Start collecting** opens signup. **Add to Chrome** opens the live Chrome Web Store listing. iPhone is **Beta**, with support as the route to TestFlight access.

## Direction and memorable moment

The centered white “Found it? Keep it. Let your mind wander.” headline sits above an azure mountain horizon, with a small glass capture dock beneath the actions. Spacious white sections continue into rounded sky and mint panels with lightly rotated windows, a phone share sheet, and folder artwork. The closing CTA and footer repeat the mountain scenery.

Use actual tokens in [DESIGN.md](../../../../DESIGN.md) and `landing.css`, the canonical bookmark mark, and local responsive 800px/1600px mountain WebP assets. [Desktop hero](../../../../docs/design/scenic-landing/desktop-hero.png) and [platform panels](../../../../docs/design/scenic-landing/platforms.png) record the visual treatment.

## Content and action

Sequence: scenic promise and signup/install actions → highlight capture demo → illustrative collection and source-retention benefits → disclosed actual browser-library screenshot → browser, iPhone beta, web, and organization panels → local/cloud setup choices → FAQ → scenic CTA and footer.

The demo changes only its example state and says the real library is unchanged. The collection is visibly labeled illustrative/sample content. **See the current browser library** reveals the real screenshot, labeled as the actual interface with a sample collection. Platform diagrams are decorative and `aria-hidden`, with accurate surrounding feature text. Preserve local capture without an account, explicit import consent for older local saves, and working manual ZIP, support, legal, account, and dashboard destinations.

## Responsive behavior

| Viewport | Behavior |
| --- | --- |
| 1440px | Full navigation, broad centered hero, 1100px content cap, paired capture/setup panels, three collection examples, two platform columns, and four footer columns. |
| 768px | Smaller gutters; stacked section introductions; capture, platforms, and setup stay paired; FAQ stacks; footer brand sits above three link columns. |
| 390px | Compact navigation at the 540px breakpoint; actions wrap as needed; capture, benefits, platforms, and setup stack; collection shows two examples; footer uses two link columns. |
| 320px | Same phone layout with fluid type; secondary dock copy and decorative details recede; primary actions, disclosures, FAQ, and support remain reachable without horizontal overflow. |

## Interaction and accessibility

Preserve native anchors, buttons, details/summary, semantic headings, skip navigation, icon labels, and visible focus rings. The mobile menu maintains its expanded state and label; links, outside clicks, Escape, and leaving the phone breakpoint close it. Escape restores toggle focus. Demo save/reset moves focus to the next available action and announces changes through a status region.

Motion consists of a gentle 1.3-second scenic arrival, a 0.5-second saved-card arrival, and short hover lifts. Reduced motion disables animations, transitions, and smooth scrolling. Without JavaScript, core static content, hero/footer destinations, and native disclosures remain available. Decorative scenery has empty alternative text; meaningful photos and the actual screenshot have descriptions.

## Unresolved decisions

None for this landing design. Availability and version text must follow verified releases.
