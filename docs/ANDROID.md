# AEGIS Monitor for Android

A separate Android app that runs the device monitor on the phone itself. It reads only the signals you switch on, writes each reading into the same SHA-256 hash-chained local log as the web page, and can export and check that log on the device.

It does not detect monitoring. It shows signals consistent with monitoring and reports when they change. It cannot prove that nobody is monitoring the phone.

## Why a native app, not a Capacitor wrapper

The repository already has a Capacitor wrapper for the AEGIS app, but its build pipeline overlays a manifest that declares `INTERNET`. Capacitor also adds its own permissions. This app needs no network, so it is a small native Kotlin project under `android-monitor/`. It loads the monitor page from files inside the APK, through a local-only WebView, and reads Android settings through one small bridge.

## Privacy promises, and how they are checked

| Promise | How it holds |
| --- | --- |
| No internet | The manifest has no `INTERNET` permission. `scripts/check-android-privacy.sh` reads the merged manifest and fails if any permission other than `ACCESS_NETWORK_STATE` appears. That permission only lets the app ask whether a VPN or proxy is set. |
| No outside scripts | The bundled monitor page has no `http://` or `https://` references. The check fails if any appear. |
| No analytics or SDKs | The Kotlin sources may not use network, socket, HTTP-client or analytics APIs. The check greps for them. Dependencies are limited to `androidx.webkit` and JUnit. |
| Nothing leaves the phone | The WebView refuses every address except the bundled host, and never navigates away. |
| Backups off | `allowBackup="false"`, so Android's cloud backup does not copy the log. |
| Opt-in only | Every signal group is off until you switch it on. The app works with all switches off. |
| Local log | The log lives in the app's private storage. Clearing the app's data erases it. |

## The SDK underneath

The log, the signal readers, the consent switches and the export now live in `csslabs-sdk/`, an Android library with its own README and version number (0.1.0). This app is its sample. The SDK has the same promises as the app: one permission (`ACCESS_NETWORK_STATE`), no network dependency, and no data sent off the phone. The scoring interface for the CC and SS layer is a placeholder. No mapping from device signals onto the framework's dimensions exists yet, so the app shows no score.

## The signals, and what Android allows

Each switch is on the page. None of them requests a runtime permission, because Android does not offer one for these settings. Your switch is the only gate.

- **Accessibility services.** Reads the list of enabled accessibility services. Shows names only. An accessibility service can read the screen and act for the user, so a new one is a strong signal. Android does not show what it does from here.
- **Notification access.** Reads the list of apps allowed to read notifications. Names only. Notification contents are never read.
- **Device administrators.** Reads active device administrators. Android may hide some of them from other apps. The page then says "not visible to this app".
- **User-installed certificates.** Counts certificates the user installed, and stores a SHA-256 fingerprint of each. The contents are not stored. A user certificate authority can let someone read encrypted traffic.
- **VPN and proxy.** Whether a VPN is active, and the default proxy's host and port if one is set.
- **Developer options and USB debugging.** Whether they are on.
- **Audio recording and camera use.** Android's own callbacks report how many audio recordings are active, and how many cameras are not free to this app. Android does not say which app, and the app never sees audio or video. This app itself never uses the microphone or camera.
- **Battery, network, memory, storage, screen.** Already in the web page, and shared with it in the app.

Android's Settings screens can be opened from the page for accessibility, notifications, security and developer options. The page never changes a setting.

## What Android will not let this app see

- Which app is recording audio or using the camera.
- What any accessibility service or notification listener does with what it reads.
- The list of installed apps. That needs a special permission (usage access or a package-query permission). The first version leaves them out on purpose.
- Messages, screen contents, files, or the contents of any other app.
- Activity while the app is closed. The callbacks only run while the app process is alive, so each reading shows the state since the app was opened. A background service would need a visible notification, and is not part of this first version.
- Whether the phone's operating system is itself compromised.

## Getting an APK from the repository

The workflow file is at `ci/android-monitor.workflow.yml`. It is not yet under `.github/workflows/`, because the token used to publish this branch lacked the `workflow` permission. To turn it on, move it once and push:

```
mkdir -p .github/workflows && git mv ci/android-monitor.workflow.yml .github/workflows/android-monitor.yml
```

(Or paste its contents into a new file in the GitHub web editor, which does not need the permission.)

Once it is in place, every push to `feat/aegis-android` that touches the Android project runs the workflow `Android monitor`. It:

1. runs the monitor's JavaScript tests;
2. runs the Kotlin unit tests and builds a debug APK;
3. runs the privacy checks against the built app;
4. uploads `app-debug.apk` and its SHA-256 as a workflow artifact, kept 30 days.

To install: open the run in the Actions tab, download the artifact `aegis-monitor-debug-apk`, copy the APK to the phone, and allow installs from that source when Android asks. Check the SHA-256 against the `.sha256` file first.

Debug builds from CI are signed with a key that belongs to the runner, not to you. Android will refuse to install a new debug build over an old one signed by a different key. Uninstall the old app first, which also erases its log. For upgrades that keep the log, use a release build signed with your own key.

## Signing a release with your own key (once)

1. Create the key on your own computer. Keep the file and its passwords somewhere safe and offline. Losing the key means you can never update an installed app.

   ```
   keytool -genkeypair -v -keystore aegis-monitor-release.jks -alias aegis-monitor \
     -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Store it as repository secrets. Never commit the file. The repository's `.gitignore` in `android-monitor/` already excludes `*.jks` and `*.keystore`.

   ```
   base64 -w0 aegis-monitor-release.jks > key.b64
   gh secret set AEGIS_KEYSTORE_BASE64 < key.b64
   gh secret set AEGIS_KEYSTORE_PASSWORD
   gh secret set AEGIS_KEY_ALIAS --body aegis-monitor
   gh secret set AEGIS_KEY_PASSWORD
   rm key.b64
   ```

3. Run the workflow manually with `sign_release` set to true (Actions tab, Run workflow). It produces `aegis-monitor-release-signed-apk` as an artifact. It does not publish anything.

## Publishing a Release (your call, after review)

Nothing in this repository creates a Release or a tag for this app. When you have reviewed a signed build, create one yourself:

```
gh release create aegis-monitor-v0.1.0 app-release.apk app-release.apk.sha256 \
  --prerelease --title "AEGIS Monitor 0.1.0" \
  --notes "Signed with the AEGIS Monitor release key. No INTERNET permission. Build commit: <sha>."
```

The app is a separate application (`io.aegis.monitor`) from the existing AEGIS APK, so their Releases do not collide. Use a different tag from the `apk-latest` tag the existing AEGIS workflow moves.

**Before merging this branch into `main`:** the existing workflow `.github/workflows/build-apk.yml` runs on every push to `main`. It builds the AEGIS APK and publishes releases. Merging will trigger it. Decide whether you want that at the time of merge.

## Building locally

Needs JDK 17 and the Android SDK (platform 34, build-tools 34.0.0). With Gradle 8.9 installed:

```
bash scripts/check-android-privacy.sh   # after the build below
gradle -p android-monitor testDebugUnitTest assembleDebug
bash scripts/check-android-privacy.sh
```

The first privacy run must come after the build, because it reads the merged manifest the build produces.

## Status of this first version

- The web monitor, its chain and its tests run in Node and in headless Chrome.
- The Kotlin code is written and its pure parts have unit tests. It has not been compiled or run in this repository's development environment, which has no JDK or Android SDK. CI is where it is first compiled.
- The APK has not been installed or run on a phone. Android behaviour of each signal, including which ones Android hides from this app on a given version, needs a device test.
