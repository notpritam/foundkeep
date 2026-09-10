# Social sign-in and scenic customer web

User direction: matching provider emails share a collection; social sign-in is primary; web auth, library, setup and settings inherit the approved scenic landing. Mobile keeps its approved purple Gallery.

1. Add regression coverage for multiple provider subjects sharing one verified email, password-only ownership checks, isolated different addresses, immutable subject ownership and deletion of every linked identity.
2. Migrate identity mappings to support multiple subjects per account, recording a verified-email snapshot only after the selected provider verifies that email. Legacy mappings retain ownership but get an empty snapshot until their next verified login. Migration clears old pending OAuth flows. Auto-link only when a previous trusted identity verified the same account email. Preserve the password check for an account without that evidence, transactional checks, one-use proofs and deletion markers.
3. Use a white account panel beside the existing mountain scene, Google/Apple buttons first, progressively disclosed email controls, short legal copy and visible callback/recovery errors.
4. Carry azure, sky, mint, Clarity City and Geist into the gallery, browser setup, item details and account settings. Preserve all existing controls, account boundaries, responsive layouts and reduced motion.
5. Run backend and customer browser tests; inspect desktop/mobile screenshots together; run the design detector and independent finish review; document the built surfaces.
6. Back up SQLite, deploy the tested revision, verify live pages and provider discovery. Real successful provider authentication still needs an account owner to complete the provider UI.

Verification includes legacy identity migration with data intact, social provider discovery failure falling back to email, email recovery, search/filter/note/pairing/settings, and native credentials opening the same account. No Supabase key or session enters a browser bundle.
