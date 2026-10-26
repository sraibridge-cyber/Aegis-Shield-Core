#!/usr/bin/env bash
# verify-release.sh — check a published AEGIS APK against the checksum served beside it.
#
# Why this exists:
# The install page tells a visitor to download app-debug.apk and compare it with the
# app-debug.apk.sha256 asset published next to it. That instruction is only worth
# something if the comparison can be reproduced by someone who trusts neither the page
# nor this repository. This script performs exactly that comparison and nothing else: it
# reads the two public asset URLs out of the GitHub release metadata, checks that the
# sidecar is a file sha256sum can read, and runs sha256sum -c against the binary.
#
# What a pass establishes:
# The bytes you downloaded are the bytes the release records.
#
# What it does not establish:
# Who built them, that any commit in this repository produces them (the build is not
# bit-reproducible), or that the code is safe to run. The debug signature identifies no
# publisher.
#
# Usage:
#   bash scripts/verify-release.sh                       # verifies apk-latest
#   bash scripts/verify-release.sh apk-20261026T131213Z   # verifies one archived build
#
# Needs curl and sha256sum. No credentials: every asset read here is public. If
# GITHUB_TOKEN or GH_TOKEN is set it is used for the single metadata request only, which
# keeps the script inside the API rate limit when CI runs it.
set -euo pipefail

REPO="${AEGIS_REPO:-sraibridge-cyber/Aegis-Shield-Core}"
TAG="${1:-apk-latest}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { printf '%s\n' "$*"; }
die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

say "release    : $TAG"
say "repository : $REPO"

# The metadata request may carry a token; the asset downloads may not. GitHub redirects
# asset URLs to a storage host that rejects a request carrying an Authorization header,
# so sending the token to both would break the download for the sake of the rate limit.
if [ -n "$TOKEN" ]; then
  curl -fsSL --retry 2 -H "Authorization: Bearer $TOKEN" \
       -H 'Accept: application/vnd.github+json' \
       "https://api.github.com/repos/$REPO/releases/tags/$TAG" -o "$TMP/release.json" \
    || die "the GitHub API returned no metadata for tag '$TAG' (a tag that does not exist and a network failure both land here)"
else
  curl -fsSL --retry 2 -H 'Accept: application/vnd.github+json' \
       "https://api.github.com/repos/$REPO/releases/tags/$TAG" -o "$TMP/release.json" \
    || die "the GitHub API returned no metadata for tag '$TAG' (a tag that does not exist, an exhausted unauthenticated rate limit, and a network failure all land here)"
fi

APK_URL="$(grep -oE '"browser_download_url": *"[^"]*app-debug\.apk"' "$TMP/release.json" | head -n1 | sed -E 's/.*"(https:[^"]+)".*/\1/')"
SUM_URL="$(grep -oE '"browser_download_url": *"[^"]*app-debug\.apk\.sha256"' "$TMP/release.json" | head -n1 | sed -E 's/.*"(https:[^"]+)".*/\1/')"

[ -n "$APK_URL" ] || die "release '$TAG' publishes no app-debug.apk asset"
[ -n "$SUM_URL" ] || die "release '$TAG' publishes no app-debug.apk.sha256 asset, so its download cannot be checked by the documented procedure"

curl -fsSL --retry 2 "$APK_URL" -o "$TMP/app-debug.apk" || die "the published app-debug.apk did not download"
curl -fsSL --retry 2 "$SUM_URL" -o "$TMP/app-debug.apk.sha256" || die "the published app-debug.apk.sha256 did not download"

LINES="$(wc -l < "$TMP/app-debug.apk.sha256" | tr -d ' ')"
NAME="$(awk 'NR==1{print $2}' "$TMP/app-debug.apk.sha256")"
RECORDED="$(awk 'NR==1{print $1}' "$TMP/app-debug.apk.sha256")"

say "apk bytes  : $(wc -c < "$TMP/app-debug.apk" | tr -d ' ')"
say "sidecar    : $LINES line(s), filename field '${NAME:-EMPTY}', digest field '${RECORDED:-EMPTY}'"

if [ "$LINES" != "1" ]; then
  die "the sidecar has $LINES lines. sha256sum -c reads exactly one digest line, so this release records a checksum no reader can check. The APK may still be intact; the record is not usable."
fi
if [ "$NAME" != "app-debug.apk" ]; then
  die "the sidecar names '${NAME:-EMPTY}' instead of app-debug.apk, so sha256sum -c would look for a file that was never downloaded."
fi
case "$RECORDED" in
  *[!0-9a-f]*|'') die "the sidecar's digest field '${RECORDED:-EMPTY}' is not lowercase hexadecimal" ;;
esac
if [ "${#RECORDED}" != "64" ]; then
  die "the sidecar's digest field is ${#RECORDED} characters, not 64"
fi

GOT="$(sha256sum "$TMP/app-debug.apk" | cut -d' ' -f1)"
say "computed   : $GOT"

if ! ( cd "$TMP" && sha256sum -c app-debug.apk.sha256 >/dev/null 2>&1 ); then
  die "sha256sum -c rejects the published pair. The recorded digest and the published binary disagree, or the sidecar is not in the format that tool reads."
fi
if [ "$GOT" != "$RECORDED" ]; then
  die "sha256sum -c passed but the recorded digest '$RECORDED' is not the computed digest '$GOT'"
fi

say "RESULT     : MATCH - the published sidecar describes the published binary"
say ""
say "Establishes: the bytes you downloaded are the bytes this release records."
say "Does not establish: who built them, that any commit in this repository produces"
say "them (builds are not bit-reproducible), or that the code is safe to run. The debug"
say "signature identifies no publisher."
