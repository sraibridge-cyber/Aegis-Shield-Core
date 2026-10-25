#!/usr/bin/env bash
# remove-host-beacons.sh — remove host-injected telemetry from an AEGIS build.
#
# Why this exists:
# The hosted AEGIS build carries two injections that are not part of the app:
#   1. an inline navigator.sendBeacon('/__va', ...) script in index.html, and
#   2. a __vincen__/collector.js that beacons page loads, route changes, JS
#      errors and failed requests to /__vincen__/log.
# A clean build from the public repository does not contain them. This script
# removes them from a vendor bundle you already have, so you can inspect or
# self-host a copy without the host's telemetry. It does not modify the app's
# own code.
#
# Usage:
#   ./scripts/strip-host-beacons.sh [TARGET_DIR]
#   TARGET_DIR defaults to ./dist
#
# The script is idempotent. It removes:
#   - TARGET_DIR/__vincen__/ (the collector)
#   - any <script> in TARGET_DIR/index.html whose body contains
#     navigator.sendBeacon('/__va') or navigator.sendBeacon("/__va")
#   - any inline <script> that assigns window.__VINCEN__
# It then reports the remaining matches. The app's own outbound-audit wrapper
# (which counts fetch/XHR/WebSocket/EventSource/sendBeacon calls) is app code
# and is intentionally left in place.
set -euo pipefail

TARGET="${1:-dist}"
if [ ! -d "$TARGET" ]; then
  echo "strip-host-beacons: target directory not found: $TARGET" >&2
  exit 1
fi

python3 - "$TARGET" <<'PY'
import os
import re
import shutil
import sys

target = sys.argv[1]
removed = []

collector = os.path.join(target, "__vincen__")
if os.path.isdir(collector):
    shutil.rmtree(collector)
    removed.append("removed __vincen__/ (collector)")

index = os.path.join(target, "index.html")
if os.path.isfile(index):
    with open(index, encoding="utf-8") as fh:
        original = fh.read()

    def drop_host_script(match):
        body = match.group(0)
        if (
            "sendBeacon('/__va'" in body
            or 'sendBeacon("/__va"' in body
            or "window.__VINCEN__" in body
        ):
            return ""
        return body

    updated = re.sub(
        r"<script\b[^>]*>.*?</script>",
        drop_host_script,
        original,
        flags=re.S | re.I,
    )
    if updated != original:
        with open(index, "w", encoding="utf-8", newline="") as fh:
            fh.write(updated)
        removed.append("removed inline host beacon script(s) from index.html")

print("strip-host-beacons: " + ("; ".join(removed) if removed else "nothing to remove"))
PY

echo "strip-host-beacons: remaining matches in $TARGET (app code may still contain the words):"
for pattern in "__vincen__" "__va" "sendBeacon" "cloudflareinsights" "cdn-cgi" "telemetry" "analytics" "beacon"; do
  count=$( (grep -RIl --exclude-dir=node_modules -F "$pattern" "$TARGET" 2>/dev/null || true) | wc -l )
  echo "  $pattern: $count file(s)"
done
echo "strip-host-beacons: done. Review the remaining matches; the app's own outbound-audit wrapper is expected to contain sendBeacon."
