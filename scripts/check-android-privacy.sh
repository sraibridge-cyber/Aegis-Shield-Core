#!/usr/bin/env bash
# Checks the built AEGIS Monitor app against its privacy promises. Run after a
# Gradle build from the repository root:
#   bash scripts/check-android-privacy.sh
#
# Fails (exit 1) if any of these is true:
#   - the merged manifest declares any permission other than ACCESS_NETWORK_STATE
#     (in particular no INTERNET), or cleartext traffic is allowed;
#   - the bundled web files reference any http(s) address;
#   - the Kotlin sources use network, socket or HTTP client APIs;
#   - the Gradle dependencies include anything beyond the allowed list.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/android-monitor/app"
fail=0
say() { echo "$1"; }
bad() { echo "FAIL: $1"; fail=1; }

# 1. Merged manifest (the one Android will install).
MANIFEST="$(find "$APP/build" -path '*merged*' -name AndroidManifest.xml 2>/dev/null | head -n 1 || true)"
if [ -z "$MANIFEST" ]; then
  echo "FAIL: no merged AndroidManifest.xml under $APP/build. Build the app first."
  exit 1
fi
say "merged manifest: ${MANIFEST#$ROOT/}"

# Parse the manifest as XML and read the uses-permission elements. A text search also
# matches comments and attribute text, so it is only used to show where a mention sits.
if ! python3 - "$MANIFEST" <<'PY'
import sys
import xml.etree.ElementTree as ET
A = '{http://schemas.android.com/apk/res/android}'
ALLOWED = {'android.permission.ACCESS_NETWORK_STATE'}
path = sys.argv[1]
root = ET.parse(path).getroot()
names = sorted({e.get(A + 'name') for e in root.iter('uses-permission') if e.get(A + 'name')})
print('uses-permission elements in the merged manifest: ' + (', '.join(names) or 'none'))
bad = [n for n in names if n not in ALLOWED]
for n in bad:
    print('FAIL: manifest declares %s (only ACCESS_NETWORK_STATE is allowed)' % n)
if 'android.permission.INTERNET' not in names:
    print('android.permission.INTERNET is not declared as a permission element')
with open(path, encoding='utf-8', errors='replace') as fh:
    for lineno, line in enumerate(fh, 1):
        if 'android.permission.INTERNET' in line:
            print('text mention at line %d: %s' % (lineno, line.strip()[:200]))
sys.exit(1 if bad else 0)
PY
then
  fail=1
fi
if grep -q 'usesCleartextTraffic="true"' "$MANIFEST"; then
  bad "cleartext traffic is allowed"
fi

# 2. Bundled web files: no outside addresses.
WEB="$APP/build/generated/monitor-assets/monitor"
if [ ! -d "$WEB" ]; then
  bad "bundled web folder missing: $WEB"
else
  if grep -RIlE 'https?://' "$WEB" >/dev/null 2>&1; then
    bad "bundled web files reference an outside address:"
    grep -RInE 'https?://' "$WEB" | head -n 10
  else
    say "bundled web files: no http(s) addresses"
  fi
fi

# 3. Kotlin sources: no network or socket APIs.
SRC="$APP/src/main/java"
NET='java\.net\.|HttpURLConnection|OkHttp|Retrofit|URLConnection|java\.net\.Socket|SocketChannel|DatagramSocket|WebSocket|ConnectivityManager\.requestNetwork|Volley|Firebase|Crashlytics|Sentry|Amplitude|Mixpanel'
if grep -RInE "$NET" "$SRC" >/dev/null 2>&1; then
  bad "Kotlin sources use a network or analytics API:"
  grep -RInE "$NET" "$SRC" | head -n 10
else
  say "Kotlin sources: no network, socket or analytics APIs"
fi

# 4. Dependencies: the allowed list only.
DEPS="$(grep -E '^\s*(implementation|testImplementation|api|runtimeOnly)\(' "$APP/build.gradle.kts" | sed 's/^ *//' || true)"
ALLOWED_DEPS='androidx.webkit:webkit:|junit:junit:|project\(":csslabs-sdk"\)'
while IFS= read -r line; do
  [ -z "$line" ] && continue
  if ! echo "$line" | grep -qE "$ALLOWED_DEPS"; then
    bad "dependency not on the allowed list: $line"
  fi
done <<< "$DEPS"
say "dependencies: $(echo "$DEPS" | sed 's/.*("//; s/").*//' | tr '\n' ' ')"

# 5. The SDK (csslabs-sdk): its source manifest, its sources, its dependencies.
SDK="$ROOT/csslabs-sdk"
if [ -d "$SDK" ]; then
  SDK_MANIFEST="$SDK/src/main/AndroidManifest.xml"
  for p in $(grep -o 'uses-permission[^>]*android:name="[^"]*"' "$SDK_MANIFEST" | sed 's/.*android:name="\([^"]*\)".*/\1/'); do
    if [[ "$ALLOWED" != *" $p "* ]]; then bad "SDK manifest declares $p"; fi
  done
  if grep -q 'android.permission.INTERNET' "$SDK_MANIFEST"; then bad "SDK manifest declares INTERNET"; fi
  if grep -RInE "$NET" "$SDK/src/main/java" >/dev/null 2>&1; then
    bad "SDK sources use a network or analytics API:"
    grep -RInE "$NET" "$SDK/src/main/java" | head -n 10
  else
    say "SDK sources: no network, socket or analytics APIs"
  fi
  SDK_DEPS="$(grep -E '^\s*(implementation|api|runtimeOnly|compileOnly)\(' "$SDK/build.gradle.kts" | sed 's/^ *//' || true)"
  if [ -n "$SDK_DEPS" ]; then bad "SDK declares runtime dependencies: $SDK_DEPS"; fi
  if grep -RInE 'https?://' "$SDK/src/main/java" >/dev/null 2>&1; then
    bad "SDK sources reference an outside address"
  else
    say "SDK sources: no http(s) addresses"
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo "privacy checks: FAILED"
  exit 1
fi
echo "privacy checks: PASSED"
