#!/usr/bin/env bash
# Regenerate the branded download plus the legacy update-compatible ZIP from
# apps/extension so both old links and the Foundkeep landing page stay valid.
# (zip isn't installed on omni, so this uses python's zipfile.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - "$ROOT" <<'PY'
import zipfile, os, sys, shutil, tempfile
root = sys.argv[1]
src = os.path.join(root, "apps", "extension")
include = ["manifest.json", "icons", "assets", "src", "README.md"]
for archive, folder in [("foundkeep-extension.zip", "foundkeep-extension"), ("atlas-extension.zip", "atlas-extension")]:
    out = os.path.join(root, "apps", "web", archive)
    with tempfile.TemporaryDirectory() as tmp:
        stage = os.path.join(tmp, folder)
        os.makedirs(stage)
        for item in include:
            s, d = os.path.join(src, item), os.path.join(stage, item)
            shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for r, _, fs in os.walk(stage):
                for f in fs:
                    full = os.path.join(r, f)
                    if f in ('control-bg.js', 'agent-control.js') or f.endswith(('.pem', '.key')):
                        continue
                    z.write(full, os.path.relpath(full, tmp))
    print("wrote", out, os.path.getsize(out), "bytes")
PY
