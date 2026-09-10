# Foundkeep React web migration

The customer web currently consists of static HTML plus imperative JavaScript. Replace its customer-facing routes with a Next.js App Router application without changing the existing backend authentication or capture protocols. User explicitly authorized the migration and deployment; preserve the approved scenic visual direction.

Public landing, support, privacy and terms use static pre-rendering and small React interaction islands. The auth surface fills the viewport, its story footer stays at the bottom, and valid existing sessions redirect before rendering the form. OAuth completion/account-link/deletion handoffs must remain reachable even with an existing session. Dashboard checks its session on the server, renders the first collection response, and uses React/TanStack Query for subsequent requests, mutations and account-scoped in-memory caching. Search, type, selected capture and open panel are URL state; credentials never are.

Keep the Bun/Hono backend, SQLite, cookies, bearer connections, capture ownership guards, PKCE-like provider proof, and provider secrets behind the backend. Next only forwards the inbound session cookie to a fixed loopback backend URL; no Supabase client SDK, keys or tokens reach the frontend. Private server fetches use no-store, account context accompanies dependent requests, and caches clear on expiry or account change.

Clean routes: /, /login, /signup, /recover, /auth (provider handoff), /dashboard, /support, /privacy, /terms, /open. Permanent redirects preserve legacy .html links and their query parameters. Keep API, AASA, binary downloads, XML updates and assets compatible with installed iPhone and extension builds.

Deploy Next as a separate loopback systemd service behind the existing Caddy host. Direct API/upload traffic remains on the existing backend, without new buffering limits. Preserve shared Caddy sites and production's unrelated auth documentation changes. Build and integration tests run before switching the web upstream. Retain a rollback path.

Versions checked against npm/official docs: Next 16.3.4, React 19.3.0, TanStack Query 5.102.8. Native Expo/extension versions and dependencies remain unchanged.
