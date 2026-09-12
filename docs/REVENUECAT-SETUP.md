# Foundkeep mobile subscriptions — RevenueCat setup

The implementation is in the iPhone app and live backend. **1.0.0 (18)** includes `react-native-purchases`, has passed Apple processing, and is assigned to **Foundkeep Internal** in TestFlight. Purchases are disabled until RevenueCat configuration is present. Existing native build 15 cannot receive this SDK through an OTA update; install build 18 first.

## 1. App Store Connect

Open Foundkeep (`app.foundkeep.ios`, App Store ID `6809771188`) → Monetization → Subscriptions.

Already created through your App Store Connect API access:

- Subscription group **Foundkeep Pro**, Apple group ID **22378877**, with an English display name.
- Auto-renewable **Foundkeep Pro Monthly**, product ID **`app.foundkeep.pro.monthly`**, Apple product ID **6811311907**, duration **1 month**.
- US monthly price **$4.99**, with Apple-equalized prices across **175 territories**. The app uses Apple's localized price; the web plan remains exactly USD $5.
- English product display name **Foundkeep Pro** and description **Automatic tags, summaries and linked saves.**

Before App Review:

1. Review regional prices and availability. This is an ordinary renewable one-month subscription, without an annual payment commitment.
2. Ensure Paid Apps agreements, tax and banking information are active.
3. After configuring RevenueCat and verifying sandbox purchases, add a review screenshot showing the actual localized offering. The current unavailable screen is not a purchase review screenshot.
4. Attach this first subscription to the app version when submitting for App Review. The product remains a draft until its remaining metadata and review requirements are complete.

Apple's subscription setup: https://developer.apple.com/app-store/subscriptions/

## 2. RevenueCat project

1. Create a project named **Foundkeep** in your own RevenueCat account.
2. Add an **App Store** app using bundle ID **`app.foundkeep.ios`**.
3. Follow RevenueCat's App Store connection instructions for App Store Connect API / In-App Purchase credentials. The earlier Sign in with Apple `.p8` is an authentication key, not a replacement for Apple purchase credentials.
4. Import product **`app.foundkeep.pro.monthly`** into Product catalog.
5. Create entitlement **`pro`** and attach this product.
6. Create an offering **`default`**, make it current, and add the product as its monthly package.
7. Review restore/transfer behavior for your account policy. Foundkeep handles RevenueCat transfer notifications by verifying both known account identities. A purchase can only grant access to the account RevenueCat currently associates with it.

Entitlement instructions: https://www.revenuecat.com/docs/getting-started/entitlements
Expo SDK instructions: https://www.revenuecat.com/docs/getting-started/installation/expo

## 3. Backend configuration

Provide these through the private server environment, never a committed file or public build variable:

The private BB credential form writes the three credentials to `/home/pritam/.config/foundkeep/revenuecat.env`. The production service has an optional `EnvironmentFile` entry for this path. After the project/product/webhook are configured and credentials supplied, restart the backend to load them and verify the offering. Do not read or print that file into chat or logs.

| Variable | Value |
| --- | --- |
| `REVENUECAT_IOS_PUBLIC_KEY` | RevenueCat App Store public SDK key beginning `appl_` |
| `REVENUECAT_SECRET_KEY` | Server secret with permission to read subscribers and delete customers using RevenueCat API v1 |
| `REVENUECAT_WEBHOOK_AUTH` | A new random authorization string, identical to the webhook configuration |
| `REVENUECAT_ENTITLEMENT_ID` | `pro` |
| `REVENUECAT_MONTHLY_PRODUCT_ID` | `app.foundkeep.pro.monthly` |
| `REVENUECAT_ALLOW_SANDBOX` | `true` only in an isolated test environment; default `false` |
| `REVENUECAT_SANDBOX_ACCOUNT_IDS` | Optional comma-separated Foundkeep account IDs allowed to verify TestFlight purchases on the production API; empty by default |

The public SDK key is intentionally returned to the iPhone app. It is a publishable identifier, not a provider secret. The server secret, webhook authorization, OpenAI key, Supabase keys and Stripe secret never reach the app. The SDK's customer ID is a random `fk_…` identity mapped by our backend; it is not the account email or account UUID.

## 4. Webhook

RevenueCat → Integrations → Webhooks → Add configuration:

- Name: **Foundkeep backend**
- URL: **`https://foundkeep.app/api/billing/webhooks/revenuecat`**
- Authorization header: exact value of `REVENUECAT_WEBHOOK_AUTH`
- App: Foundkeep
- Events: all subscription and transfer events
- Environment: production and sandbox when testing with explicitly allowlisted Foundkeep accounts; otherwise production only

The endpoint authenticates the request, looks up known opaque identities, fetches the current RevenueCat subscriber state, and updates the shared Pro entitlement. It does not trust a client claim that a purchase succeeded. Repeated events are idempotent. Unknown customer IDs do not gain access.

Webhook instructions: https://www.revenuecat.com/docs/integrations/webhooks

## 5. Test before submitting

Install **1.0.0 (18)** from [Foundkeep TestFlight](https://appstoreconnect.apple.com/apps/6809771188/testflight/ios). It was built and uploaded under Expo owner **notpritam**, project **33362145-2b45-4d86-bb08-cd10c6bfae61**, using `notpritamsharma@gmail.com`. Its fingerprint runtime is `f82707b954c566999320c3a2a6352710a0f40abb`.

The current app and native share extension use `https://foundkeep.app`. To test this binary, keep global sandbox access off and add only the dedicated test account IDs to `REVENUECAT_SANDBOX_ACCOUNT_IDS`. Include sandbox events in the webhook integration. Other production accounts still reject sandbox entitlements. Remove test access when testing ends. A separate staging backend requires a matching app/auth/share environment build; changing only the API URL is insufficient.

With the test accounts configured, test: sign in → You → Your plan → localized monthly offering → purchase → verified Pro. Restore after reinstalling; switch Foundkeep accounts during a pending action; leave web checkout open and start purchase/restore on iPhone; cancel one attempt while another restore is running; cancel renewal; allow sandbox expiration; test a refund/transfer event; verify the dashboard sees the same Pro state. Revoking a Foundkeep device must remove its account access. Deleting the app/account does not cancel Apple billing; the app points users to Apple subscription settings.

Update App Privacy with **Purchases / Purchase History**, linked to user, used for app functionality, not tracking. Existing account and user-content disclosures remain. The app includes an updated privacy manifest. Add the subscription to App Review and update the reviewer instructions before submission.

## OTA boundaries

Once this native binary is installed, compatible JavaScript UI and logic may ship through EAS Update for its fingerprint runtime. Offerings, prices, product availability, Pro status and feature controls refresh from Apple, RevenueCat and the backend. Native SDK upgrades, StoreKit/native changes, entitlements and manifest changes need a new Store build. The app does not load remote executable code from RevenueCat.
