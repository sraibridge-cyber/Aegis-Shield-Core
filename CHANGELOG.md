# Changelog

## 2026-10-26 — Segment 3: Hull Access native capability bridge

**STATUS: written, not compiled.** No JVM, Gradle, Android SDK, or device was used. The `HullTelemetry` Java plugin has not been compiled or run.

### Added

- `native/plugins/hull-telemetry/` — Capacitor plugin package, TypeScript definitions, registration, web stub, Android build files, and `HullTelemetryPlugin.java`.
- `src/lib/hull-bridge.ts` — typed client with the single envelope shape, capability groups, permission state, and local audit record.
- `public/assets/hull-bridge.js` — runtime bridge and ACCESS surface; injects the capability board into `/wiring` and VITALS/ENVIRONMENT into `/nerve` without adding a nav destination.
- `SEGMENT-3-HULL-ACCESS-REPORT.md` — what is written and verified, what is written but not compiled, what CI will prove, platform restrictions, and out-of-scope items.

### Changed

- `native/scripts/install-plugin.sh` — copies and registers both `AegisKeystorePlugin` and `HullTelemetryPlugin`.
- `native/capacitor.config.json` — declares the `HullTelemetry` plugin.
- `.github/workflows/android.yml` — step name now covers both plugins.
- `index.html` — loads the runtime bridge after the app bundle.
- `README.md` — capability and permission table; repo-vs-published divergence note.

### Not executed

- Java compilation, Gradle, APK/AAB, device tests, and the native permission flow were not run.

## 2026-10-25 — Segment 2: Seal A hardware-backed key storage

**STATUS: written, not compiled.** No JVM, Gradle, Android SDK, or device was used. The Java plugin and the DER conversion have not been compiled or run.

### Added

- `native/plugins/aegis-keystore/` — Capacitor plugin package, TypeScript definitions, registration, web stub, Android build files, `AegisKeystorePlugin.java`, `EcdsaDer.java`, and `EcdsaDerTest.java`.
- `native/scripts/install-plugin.sh` — copies the plugin into the generated Android project and registers it in `MainActivity`.
- `src/lib/ecdsa-interop.ts` and `public/assets/ecdsa-interop.js` — DER ↔ raw conversion, SPKI import, and raw verification.
- `src/lib/seal-a-provider.ts` and `public/assets/seal-a-provider.js` — Seal A provider bridge.
- `public/assets/aegis-keystore-web.js` — web stub that reports `available:false` and `NOT_A_NATIVE_BUILD`.
- `docs/KEYSTORE.md` — backend ladder, DER/raw fact, auth-gated key risk, and what a hardware-backed signature does and does not prove.
- `DISTRIBUTION-REPORT.md` — Segment 2 status and the user-run compile command.

### Changed

- `public/assets/index-CL6IUdNY.js` — Seal A generation and signing call sites route through the bridge; checkpoints and the model delta carry `keyProvider` and `securityLevel`.
- `public/assets/selftest-4a7c1e.js` — five new browser checks for DER/raw interop and the web stub.
- `.github/workflows/android.yml` — calls `native/scripts/install-plugin.sh` after `npx cap add android`.
- `native/README.md` — provider matrix and the "what this upgrade does and does not prove" section.
- `README.md` — the APK path is marked OPTIONAL / EXPERIMENTAL; the browser install action remains the primary route.

### Not executed

- Java compilation, Gradle, APK/AAB, device tests, and the Java unit test were not run.

## 2026-10-25 — app 44.2.0 / spec aegis44/2

This entry covers the public repository cleanup and the build it publishes. The app version and spec version are taken from the source: `appVersion` is `44.2.0`, `specVersion` is `aegis44/2`, and the service-worker cache is `aegis44-ble-1`.

### Repository

- Replaced the scaffolding template README with an AEGIS README covering what the app is, what it is not, the 15 routes, browser and home-screen use, offline use after one load, the build commands, self-hosting, the vendor-hosted difference, the framework divergences, the licence, and the closing limitations.
- Added `LICENSE` (MIT, Complex System Sanity Labs / Kyle S. Whitlock).
- Added `SECURITY.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/VERIFICATION.md`, `docs/FRAMEWORK.md`, and `scripts/strip-host-beacons.sh`.
- Removed the host telemetry from the source tree: deleted `public/__vincen__/collector.js`, removed the inline `navigator.sendBeacon('/__va', ...)` script from `index.html`, and removed the `window.__VINCEN__` / `navigator.sendBeacon` block from `src/routes/__root.tsx`.
- No Vite plugin, build script, or postinstall step was found that re-injects the beacons. The build-time vector was Vite copying `public/` into `dist/`; removing the collector and the inline script removes it.

### App surface

- 15 hash routes: `/`, `/nerve`, `/mind`, `/memory`, `/soul`, `/verify`, `/clock`, `/free`, `/install`, `/wiring`, `/selftest`, `/self-test`, `/guide`, `/instance`, `/recovery`.
- SHA-256 hash chain over `seq`, `ts`, `type`, `payloadHash` and `prevHash`, with a Merkle tree over record hashes.
- ECDSA P-256 checkpoint seals. Seal A is non-extractable and device-bound. Seal B is optional and can be kept off-device as a passphrase-wrapped keeper file.
- AES-GCM-256 encrypted local vault with PBKDF2-SHA256 key derivation (310,000 iterations).
- Six-domain `μ` score (E 0.30, L 0.30, S 0.15, F 0.10, V 0.08, D 0.07), computed as a renormalised weighted arithmetic mean over measured domains, with partial and unavailable domains labelled.
- JSON evidence pack, `AFFIDAVIT.txt`, and standalone checkpoint receipts; delivery through share sheet, blob download, data-URL download, then manual copy.
- Third-party verifier that recomputes record hashes, previous-hash continuity, sequence continuity, Merkle root, Seal A and Seal B signatures, embedded fingerprint, checkpoint chain, and anchor digest.
- 41-check in-app self-test, including a tamper test that mutates record 2 and requires the verifier to name it.
- Service worker (`service-worker.js`) and web app manifest (`manifest.json`) for offline and installable use.
- Runtime outbound audit over `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `navigator.sendBeacon`.

### Known divergences

The shipped MIND scorer uses a weighted arithmetic mean, not the framework's weighted geometric mean. τ is not empirically calibrated from a reference battery. There is no external timestamp authority or third-party anchor. The app does not compute the framework's `sanity = (μ ≥ τ) ∧ R(S) ∧ G(S)` predicate. See `docs/FRAMEWORK.md`.
