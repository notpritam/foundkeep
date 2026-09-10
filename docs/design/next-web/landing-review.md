# Landing finish review

Reviewed the relocated Next production artifact at `http://127.0.0.1:18791/` on 10 September 2026. No production state was changed.

The scenic mountain hero retains one primary action and a compact availability row. A quiet dark ground now protects the small white status/link text over mountain detail. Browser status and its action wrap together on phones; the detached divider is gone. Private iPhone access says **Request iPhone beta**.

Three behavior checks failed before correction: a valid current extension response waited for a silent legacy ID; the phone menu stayed open after an outside click; resizing to desktop left it open. Extension and website-session results now publish independently, preserving the distinction between installed and connected. The menu closes on outside pointer/focus, Escape, navigation and desktop resize; Escape restores toggle focus. Menu links use a visible azure keyboard outline on white.

Motion remains limited to the existing hero arrival, small scenic scroll movement and section reveals. Native anchor scrolling is applied to the document root. Enabling reduced motion stops an active Motion reveal and shows its final content immediately. No scroll event loop, scroll hijacking, new imagery or animation library was introduced.

Account destinations in the landing controls use full document anchors so private routes receive their document CSP. Public home navigation remains a Next Link.

## Evidence

- [Desktop hero](landing-hero-desktop.png) and [phone hero](landing-hero-mobile.png): final visual confirmation, captured from the production build, without development controls.
- [Browser results](landing-review.json): all checks passed at 1440, 768, 390 and 320px, with no horizontal overflow, missing loaded images or browser page errors.
- [Reproducible checks](landing-review.mjs): menu keyboard/outside/resize behavior, initial and live reduced motion, full-document login navigation, and installed/connected fixtures appearing within 1.8 seconds despite an unresponsive legacy extension ID.
- `npm run --workspace @foundkeep/site typecheck`: passed.

The extension checks use local browser fixtures, not a claim about a real user's installed extension. Production build checks passed; the live cutover is recorded in verification.md. Visual disposition: ready for the final production build at this reviewed scope.

The resize regression waits up to one second for the React state update after CSS hides the mobile menu. The immediate assertion raced that update; the production behavior completed within the bound.
