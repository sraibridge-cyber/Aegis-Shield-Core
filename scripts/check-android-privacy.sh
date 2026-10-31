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

ALLOWED=" android.permission.ACCESS_NETWORK_STATE "
PERMS="$(grep -o 'uses-permission[^>]*android:name="[^"]*"' "$MANIFEST" | sed 's/.*android:name="\([^"]*\)".*/\1/' | sort -u || true)"
for p in $PERMS; do
  if [[ "$ALLOWED" != *" $p "* ]]; then
    bad "manifest declares $p (only ACCESS_NETWORK_STATE is allowed)"
  fi
done
if grep -q 'android.permission.INTERNET' "$MANIFEST"; then
  bad "manifest declares android.permission.INTERNET"
fi
if grep -q 'usesCleartextTraffic="true"' "$MANIFEST"; then
  bad "cleartext traffic is allowed"
fi
say "permissions in manifest: $(echo $PERMS | tr '\n' ' ')"

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
ALLOWED_DEPS='androidx.webkit:webkit:|junit:junit:'
while IFS= read -r line; do
  [ -z "$line" ] && continue
  if ! echo "$line" | grep -qE "$ALLOWED_DEPS"; then
    bad "dependency not on the allowed list: $line"
  fi
done <<< "$DEPS"
say "dependencies: $(echo "$DEPS" | sed 's/.*("//; s/").*//' | tr '\n' ' ')"

if [ "$fail" -ne 0 ]; then
  echo "privacy checks: FAILED"
  exit 1
fi
echo "privacy checks: PASSED"
