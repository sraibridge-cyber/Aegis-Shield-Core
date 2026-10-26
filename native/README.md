# Native Android wrapper

This directory is a minimal Capacitor 6 wrapper for the AEGIS web build. It bundles the static web assets into an Android app. It is configuration only: no APK is included in this repository.

## Local build

From this directory:

```bash
npm install
npm run sync-web
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run sync-web` copies the repository's actual web bundle (`../index.html` plus `../public/`) into `./www`. There is no `dist/` in this tree.

## Version pin

`.github/workflows/build-apk.yml` installs `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` and `@capacitor-community/bluetooth-le` at major 6 in an isolated build directory, then asserts every `@capacitor` package declared in `native/package.json` against the major it actually installed. The declarations in this directory therefore have to stay on 6: bumping one without the other fails the build rather than shipping an APK this repository does not describe. The APK registers exactly three plugin classpaths — `BluetoothLe`, `AegisKeystorePlugin` and `HullTelemetryPlugin` — so a plugin declared here but not registered there is not in the shipped APK.

## Limits

- No signed release APK exists in this repository.
- The debug APK is auto-signed by a generated debug keystore and identifies nobody.
- Android WebView has no Web Bluetooth, so a native bridge is mandatory for the BLE layer.
- The device clock is still not an external timestamp authority.

## PROVIDER MATRIX

| Runtime | keyProvider | securityLevel |
| --- | --- | --- |
| Chrome on Android (browser) | `webcrypto` | `unknown` — the browser does not report a hardware level; the key is browser-held |
| Wrapper on TEE | `android-keystore` | `tee` |
| Wrapper on StrongBox (API 28+) | `android-keystore` | `strongbox` |
| Emulator / CI | `android-keystore` | `software` |

## What this upgrade does and does not prove

Attestation can show that a key lives in a secure element on a device whose boot state is in the certificate chain. It does NOT prove the device is uncompromised. It does NOT prove who is holding it. A DEBUG-SIGNED APK makes the attestation worthless because anyone can build one. Attestation chain verification against Google's root certificates is NOT implemented: record the chain and mark it NOT VERIFIED. Do not claim otherwise anywhere.
