#!/usr/bin/env bash
# Assemble the non-secret Chrome Web Store submission handoff.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ROOT/deploy/store-version.txt")"
"$ROOT/deploy/pack-store.sh"

python3 - "$ROOT" "$VERSION" <<'PY'
import hashlib
import os
import shutil
import sys
import tempfile
import zipfile

root, version = sys.argv[1:]
dist = os.path.join(root, "deploy", "dist")
store_zip = os.path.join(dist, f"foundkeep-store-{version}.zip")
assets = os.path.join(dist, "store-assets")
required_assets = [
    "extension-popup.png",
    "collection-sidebar.png",
    "customer-dashboard.png",
    "customer-browser-setup.png",
    "promo-small.png",
    "promo-marquee.png",
]
missing = [name for name in required_assets if not os.path.isfile(os.path.join(assets, name))]
if missing:
    raise SystemExit("missing store assets; run npm run store:assets: " + ", ".join(missing))

output = os.path.join(dist, f"foundkeep-cws-submission-kit-{version}.zip")
with tempfile.TemporaryDirectory() as temporary:
    stage = os.path.join(temporary, f"foundkeep-cws-{version}")
    os.makedirs(os.path.join(stage, "assets"))
    files = [
        (store_zip, f"foundkeep-store-{version}.zip"),
        (os.path.join(root, "deploy", "STORE_LISTING.md"), "STORE_LISTING.md"),
        (os.path.join(root, "deploy", "STORE_REVIEWER_GUIDE.md"), "STORE_REVIEWER_GUIDE.md"),
        (os.path.join(root, "docs", "extension-configuration-and-updates.md"), "EXTENSION_CONFIGURATION_AND_UPDATES.md"),
        (os.path.join(root, "docs", "extension-audit-1.0.1.md"), "EXTENSION_AUDIT_1.0.1.md"),
        (os.path.join(root, "docs", "AGENTIC-COLLECTIONS-OPERATIONS.md"), "AGENTIC_COLLECTIONS_OPERATIONS.md"),
    ]
    files += [(os.path.join(assets, name), os.path.join("assets", name)) for name in required_assets]
    for source, relative in files:
        destination = os.path.join(stage, relative)
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copyfile(source, destination)

    hashes = []
    for directory, subdirs, names in os.walk(stage):
        subdirs.sort()
        for name in sorted(names):
            full = os.path.join(directory, name)
            relative = os.path.relpath(full, stage)
            with open(full, "rb") as handle:
                digest = hashlib.sha256(handle.read()).hexdigest()
            hashes.append(f"{digest}  {relative}")
    with open(os.path.join(stage, "SHA256SUMS"), "w") as handle:
        handle.write("\n".join(hashes) + "\n")

    with zipfile.ZipFile(output, "w") as archive:
        for directory, subdirs, names in os.walk(stage):
            subdirs.sort()
            for name in sorted(names):
                full = os.path.join(directory, name)
                relative = os.path.relpath(full, temporary)
                info = zipfile.ZipInfo(relative, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                with open(full, "rb") as source:
                    archive.writestr(info, source.read(), compresslevel=9)
print(f"wrote {output} ({os.path.getsize(output)} bytes) — no credentials included")
PY
