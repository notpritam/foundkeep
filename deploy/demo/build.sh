#!/bin/sh
# Build the live demo's dashboard and app from this checkout into immutable
# releases under ~/.local/share/foundkeep-demo, then point `current` at them.
# Run from the main checkout (it should be on main); restart the services after.
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
DEMO=$HOME/.local/share/foundkeep-demo
STAMP=$(date +%Y%m%d%H%M%S)
mkdir -p "$DEMO/site/releases" "$DEMO/app/releases" && chmod 700 "$DEMO"
# Dashboard: the API rewrites are fixed at build time, so build against the demo backend.
(cd "$REPO/apps/site" && FOUNDKEEP_BACKEND_URL=http://127.0.0.1:8817 NEXT_TELEMETRY_DISABLED=1 /usr/bin/node ../../node_modules/next/dist/bin/next build)
/usr/bin/node "$REPO/scripts/package-site.mjs" "$DEMO/site/releases/$STAMP"
ln -sfn "$DEMO/site/releases/$STAMP" "$DEMO/site/current"
# App: the web build, served by the gateway under /app.
(cd "$REPO/apps/mobile" && FOUNDKEEP_WEB_BASE_URL=/app EXPO_NO_TELEMETRY=1 CI=1 /usr/bin/node ../../node_modules/expo/bin/cli export --platform web --output-dir "$DEMO/app/releases/$STAMP")
ln -sfn "$DEMO/app/releases/$STAMP" "$DEMO/app/current"
echo "Built demo release $STAMP. Restart: systemctl --user restart foundkeep-demo-site foundkeep-demo-gateway"
