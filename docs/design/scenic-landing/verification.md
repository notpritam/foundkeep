# Verification — September 9, 2026

- `npm run test:web`: 12/12 tests passed, including live demo save/reset, public Chrome Store target, packaged ZIP, metadata and social image, 320/390/768/1440 layout and image loading, mobile menu keyboard/dismissal/navigation, support/privacy/terms and old-domain compatibility expectations.
- Full-page screenshots at 1440×1000 and 390×844: no horizontal overflow, broken images or JavaScript errors.
- Solid-background visible text contrast: zero failing pairs after correction; decorative aria-hidden illustrations and photographic regions excluded from that calculation.
- Pixel sampling of the composited hero backdrop with text hidden: desktop minimum contrast 4.57 for the headline and 4.98 for supporting copy; phone 4.40 and 4.65. Thresholds are 3:1 for large text and 4.5:1 for supporting copy.
- Impeccable detector ran in degraded regex mode (parser dependencies absent); it only flagged the retained Geist body font. This is not treated as a complete automated accessibility audit. Clarity City supplies the display lettering.
- Independent visual review: all four original material findings resolved (hero contrast, phone share-sheet clipping, secondary text contrast, scenic footer). A subsequent closing-banner crop regression was also resolved. Final disposition: ship for the bounded findings.
- Reduced-motion mode disables authored animation/transitions; navigation and FAQ remain keyboard usable. No new third-party runtime script, remote font, framework or application dependency.

The two new scenic WebP variants are approximately 143 KiB and 45 KiB. Capture demos and collection examples are explicitly labeled. iPhone remains described as TestFlight beta; this update makes no App Store availability or social-login activation claim.
