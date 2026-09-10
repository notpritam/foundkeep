# React auth verification

The auth migration preserves the approved scenic split and renders the form through React state. `/login`, `/signup`, `/recover`, and compatibility `/auth?mode=…` use a server session guard. Provider return parameters bypass the ordinary redirect so account linking and deletion proof can finish. A failed session lookup renders a retry state.

Run the browser fixtures with Next running and its backend returning an anonymous response to `/api/me`:

```sh
FOUNDKEEP_WEB_TEST_URL=http://127.0.0.1:18792 node --test tests/next-auth.mjs
```

The tests intercept every browser `/api/**` request and do not create or delete real accounts. All addresses, recovery codes, tokens, and browser proofs in the fixtures are invented. The server session guard still makes a read-only backend `/api/me` request during page rendering.

The optional account-lifecycle integration requires a disposable backend database. It creates two test accounts, confirms that a deferred export from the first account cannot download after its dashboard unmounts and the cookie changes to the second account, then deletes both accounts:

```sh
FOUNDKEEP_WEB_TEST_URL=http://127.0.0.1:18791 FOUNDKEEP_AUTH_SECURITY=1 node --test tests/next-auth.mjs
```

Do not enable `FOUNDKEEP_AUTH_SECURITY` against a customer database. A separate navigation regression verifies that entering auth from the static landing creates a document with the private CSP; an RSC response alone cannot update the document policy. Public links into private routes use native anchors for this boundary.

Coverage: registration and recovery submission, password visibility, recovery download contents and explicit save acknowledgement, provider challenge/verifier protocol, one initial exchange under React Strict Mode, password-based account linking and incorrect-password retries, missing browser proof, transient exchange retry, explicit provider deletion confirmation with account headers, clean mode navigation and browser history, desktop footer placement, and phone scrolling without horizontal overflow. Browser runtime errors fail the suite.

The screenshot cases check 1440×1000, 1920×1080, 390×844, and 320×700. At the first three sizes the collapsed auth footer reaches the viewport bottom. At 320 pixels wide the page scrolls naturally, with the footer at the end of the document and the expanded form submission control reachable. Development screenshots include the Next development indicator.

Additional integration coverage belongs in the main Next web suite: real signed-in server redirects without JavaScript; backend session lookup outage and retry; real cookie registration/login/recovery/logout/deletion; OAuth returns while a valid session exists; backend proof expiration, ownership changes, and provider authorization. These browser fixtures do not replace backend security tests.
