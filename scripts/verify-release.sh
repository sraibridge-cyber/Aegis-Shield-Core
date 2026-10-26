#!/usr/bin/env bash
# verify-release.sh — check a published AEGIS APK against the checksum served beside it.
#
# Why this exists:
# The install page tells a visitor to download app-debug.apk and compare it with the
# app-debug.apk.sha256 asset published next to it. That instruction is only worth
# something if the comparison can be reproduced by someone who trusts neither the page
# nor this repository. This script performs that comparison and nothing else: it reads
# the two asset URLs out of the public release metadata, checks that the digest the
# sidecar records is the digest of the binary, and runs sha256sum -c wherever that
# command can actually read the sidecar.
#
# Two sidecar formats exist in this project's history, and this script reads both.
# Releases published after the checksum-format fix carry one bare digest line,
# "<hash>  app-debug.apk", which sha256sum -c reads directly. Releases published before
# it carry a legacy two-line form, "sha256:<hash>  app-debug.apk" followed by
# "bytes:<n>", which sha256sum -c rejects outright. For a legacy release this script
# compares the recorded digest against the downloaded binary directly, checks the
# recorded byte count against the published size, and states that the documented
# one-command check does not apply to that release. It never treats a sidecar as
# verified because its shape looked familiar: a legacy digest still has to equal the
# digest of the bytes, and the byte record still has to match the bytes.
#
# What a pass establishes:
# The three records a release publishes of one build — the binary, the sidecar beside it, and the
# digest written into the release body — describe the same bytes, or the body is reported as
# recording no digest at all rather than being treated as agreement.
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

# A missing match must not become a silent exit. Under `set -e` + `pipefail` a bare
# assignment from a failing pipeline aborts the script with no message at all, which
# would leave the two `die` guards below unreachable and hand the reader a non-zero
# status with nothing said. This helper always succeeds and always prints, so a release
# that publishes no asset reaches those guards and is told why.
asset_url() {
  local frag="$1" file="$2" hits
  hits="$(grep -oE "\"browser_download_url\": *\"[^\"]*${frag}\"" "$file" 2>/dev/null || true)"
  printf '%s\n' "$hits" | sed -n -E 's/.*"(https:[^"]+)".*/\1/p' | head -n1 || true
}
APK_URL="$(asset_url 'app-debug\.apk' "$TMP/release.json")"
SUM_URL="$(asset_url 'app-debug\.apk\.sha256' "$TMP/release.json")"

[ -n "$APK_URL" ] || die "release '$TAG' publishes no app-debug.apk asset"
[ -n "$SUM_URL" ] || die "release '$TAG' publishes no app-debug.apk.sha256 asset, so its download cannot be checked by the documented procedure"

curl -fsSL --retry 2 "$APK_URL" -o "$TMP/app-debug.apk" || die "the published app-debug.apk did not download"
curl -fsSL --retry 2 "$SUM_URL" -o "$TMP/app-debug.apk.sha256" || die "the published app-debug.apk.sha256 did not download"

# `wc -l` counts newline characters, so a sidecar whose last line carries no trailing
# newline is undercounted by one and then rejected by a message that misdescribes it.
# Count a final unterminated line too, and name an empty sidecar as what it is.
if [ ! -s "$TMP/app-debug.apk.sha256" ]; then
  die "the published app-debug.apk.sha256 is empty, so it records no digest and no download can be checked against it"
fi
LINES="$(wc -l < "$TMP/app-debug.apk.sha256" | tr -d ' ')"
if [ -n "$(tail -c 1 "$TMP/app-debug.apk.sha256" | tr -d '\n')" ]; then
  LINES="$((LINES + 1))"
fi
NAME="$(awk 'NR==1{print $2}' "$TMP/app-debug.apk.sha256")"
DIGEST_FIELD="$(awk 'NR==1{print $1}' "$TMP/app-debug.apk.sha256")"
BYTES_FIELD="$(awk 'NR==2{print $1}' "$TMP/app-debug.apk.sha256")"
APK_BYTES="$(wc -c < "$TMP/app-debug.apk" | tr -d ' ')"

# The digest field is the first token of line 1. A leading "sha256:" marks the legacy
# format; it is stripped so the comparison below is against the digest itself, never
# against a prefixed string that could never equal a computed hash.
FORMAT="bare"
RECORDED="$DIGEST_FIELD"
case "$DIGEST_FIELD" in
  sha256:*) FORMAT="legacy" ; RECORDED="${DIGEST_FIELD#sha256:}" ;;
esac

say "apk bytes  : $APK_BYTES"
say "sidecar    : $FORMAT format, $LINES line(s), filename field '${NAME:-EMPTY}'"
say "digest     : ${RECORDED:-EMPTY}"

case "$FORMAT" in
  bare)
    [ "$LINES" = "1" ] || die "the sidecar has $LINES lines with no 'sha256:' prefix, so it is neither the one-line format sha256sum -c reads nor the two-line legacy format this script knows"
    ;;
  legacy)
    [ "$LINES" = "2" ] || die "the sidecar begins with a 'sha256:' prefix but has $LINES line(s), not the two lines the legacy format emits"
    case "${BYTES_FIELD:-}" in
      bytes:[0-9]*) : ;;
      *) die "the legacy sidecar's second line is '${BYTES_FIELD:-EMPTY}', not a 'bytes:<n>' record, so its byte count cannot be checked" ;;
    esac
    RECORDED_BYTES="${BYTES_FIELD#bytes:}"
    if [ "$RECORDED_BYTES" != "$APK_BYTES" ]; then
      die "the legacy sidecar records $RECORDED_BYTES bytes but the published APK is $APK_BYTES bytes. The pair does not describe one another."
    fi
    say "bytes record: $RECORDED_BYTES, matching the published APK"
    ;;
esac

[ "$NAME" = "app-debug.apk" ] || die "the sidecar names '${NAME:-EMPTY}' instead of app-debug.apk, so it describes a file other than the one this release publishes"
case "$RECORDED" in
  *[!0-9a-f]*|'') die "the sidecar's digest field '${RECORDED:-EMPTY}' is not lowercase hexadecimal" ;;
esac
[ "${#RECORDED}" = "64" ] || die "the sidecar's digest field is ${#RECORDED} characters, not 64"

GOT="$(sha256sum "$TMP/app-debug.apk" | cut -d' ' -f1)"
say "computed   : $GOT"

if [ "$GOT" != "$RECORDED" ]; then
  die "the published sidecar records digest '$RECORDED' but the published APK hashes to '$GOT'. The pair does not describe one another."
fi
# Three records carry this digest: the sidecar asset, the binary it describes, and the release body
# written at publish time. Checking only the first two means a body edited after publication would
# go unnoticed, and the body is the record a reader sees first. The API's own asset digests are
# formatted "sha256:<hex>" with no space, so the pattern below matches only the body's prose form
# "sha256 <hex>" and cannot accidentally read an asset digest back as the body's claim.
BODY_DIGEST="$(grep -oE 'sha256[[:space:]]+[0-9a-f]{64}' "$TMP/release.json" | head -n1 | sed -E 's/^sha256[[:space:]]+//' || true)"
BODY_BYTES="$(grep -oE '[0-9]+ bytes' "$TMP/release.json" | head -n1 | sed -E 's/ bytes$//' || true)"
if [ -n "$BODY_DIGEST" ]; then
  if [ "$BODY_DIGEST" != "$RECORDED" ]; then
    die "the release body records digest '$BODY_DIGEST' but the published sidecar records '$RECORDED'. Two published records of the same release disagree, so at least one was changed after publication."
  fi
  say "body digest: $BODY_DIGEST, matching the sidecar"
else
  say "body digest: NOT MEASURED - this release body records no 'sha256 <digest>' line, so it cannot corroborate the sidecar"
fi
if [ -n "$BODY_BYTES" ]; then
  if [ "$BODY_BYTES" != "$APK_BYTES" ]; then
    die "the release body records $BODY_BYTES bytes but the published APK is $APK_BYTES bytes. Two published records of the same release disagree."
  fi
  say "body bytes : $BODY_BYTES, matching the published APK"
else
  say "body bytes : NOT MEASURED - this release body records no '<n> bytes' figure, so it cannot corroborate the published size"
fi

if [ "$FORMAT" = "bare" ]; then
  ( cd "$TMP" && sha256sum -c app-debug.apk.sha256 >/dev/null 2>&1 ) \
    || die "the digest matches, but sha256sum -c still rejects the sidecar, so the documented one-command check does not work on this release"
  say "sha256sum  : -c accepts the published sidecar"
else
  say "sha256sum  : NOT APPLICABLE - this release predates the sidecar format fix, so"
  say "             'sha256sum -c' rejects its sidecar even though the digest above"
  say "             matches. Verified here by direct comparison instead."
fi

say "RESULT     : MATCH - the published sidecar describes the published binary"
say ""
say "Establishes: the bytes you downloaded are the bytes this release records."
say "Does not establish: who built them, that any commit in this repository produces"
say "them (builds are not bit-reproducible), or that the code is safe to run. The debug"
say "signature identifies no publisher."
