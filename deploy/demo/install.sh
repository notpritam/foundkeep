#!/bin/sh
# Install (or refresh) the live demo's user services. Idempotent.
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
DEMO=$HOME/.local/share/foundkeep-demo
UNITS=$HOME/.config/systemd/user
mkdir -p "$DEMO/data" "$UNITS" && chmod 700 "$DEMO"
cp "$REPO/deploy/demo/gateway.mjs" "$DEMO/gateway.mjs"
for unit in backend site gateway; do
  sed "s#@REPO@#$REPO#g" "$REPO/deploy/demo/systemd/foundkeep-demo-$unit.service" > "$UNITS/foundkeep-demo-$unit.service"
done
systemctl --user daemon-reload
systemctl --user enable --now foundkeep-demo-backend foundkeep-demo-site foundkeep-demo-gateway
systemctl --user restart foundkeep-demo-backend foundkeep-demo-site foundkeep-demo-gateway
echo "Demo services running. Seed: /usr/bin/node $REPO/deploy/demo/seed.mjs"
