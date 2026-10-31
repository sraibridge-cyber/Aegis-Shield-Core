# CSS Labs Android SDK

A small library for on-device, tamper-evident monitoring of the signals an app is allowed to read. Version 0.1.0.

It records readings you switch on into a SHA-256 hash-chained local log, checks that the log, and exports it. It does not prove that nobody is monitoring the device. A flag means a change consistent with monitoring, not proof of it.

## What it does not do

- It sends nothing off the device. The SDK has no INTERNET permission and no network dependency.
- It reads no audio, video, screen contents or messages, and reads no other app's data.
- It does not use the microphone or camera. It counts how many audio recordings and camera uses Android reports, not which apps.

## Integration (10 lines)

```kotlin
// build.gradle.kts of your app: implementation(project(":csslabs-sdk"))  (or the AAR)
val monitor = CssLabsMonitor.open(context)            // everything starts off
monitor.setConsent(Signal.ACCESSIBILITY, true)         // you ask the user first
Thread {
    val result = monitor.sample()                      // records one entry per granted signal
    result.flags.forEach { Log.i("monitor", it.text) } // plain-language changes
}.start()
val status = monitor.verify()                          // ok / brokenAt / headHash
val file = monitor.exportTo(context.filesDir)          // JSON export you can check later
```

Check an export on any machine with `CssLabsMonitor.checkExport(text, savedHeadHash)`. Save the head hash somewhere other than the device. A rewritten log will not match it.

## Public API

- `CssLabsMonitor.open(context, scorer = NoScorer)` starts the monitor.
- `setConsent(signal, granted)` and `granted()` manage the switches. `Signal` has seven values: ACCESSIBILITY, NOTIFICATIONS, ADMINS, CERTIFICATES, NETWORK, DEVELOPER, INDICATORS.
- `sample()` reads every granted signal and writes one entry. Call it off the main thread.
- `verify()`, `exportText()`, `exportTo(folder)`, `checkExport(text, expectedHeadHash)`.
- `sanity()` reports rule R (log intact) and gate G (every reading taken with consent). It never gives a pass or fail verdict, because no threshold has been set.

## The CC and SS layer

`CoherenceScorer` is the interface. `Coherence.geometricMean` implements the framework's formula, `mu = exp(sum w_i ln s_i)`, over two or more dimensions. The SDK ships no scoring functions and no threshold. The framework (Technical Report v3) leaves dimensions, scoring and weights to the operator, and it requires a threshold derived from a reference battery. Device signals have no defined mapping onto those dimensions yet, so the default `NoScorer` computes nothing. Any value a scorer produces is marked uncalibrated.

## Storage

The log is `csslabs/chain.jsonl` in the app's private storage: one canonical JSON record per line, appended and never rewritten by the SDK. Clearing the app's data erases it.

## Permissions

Only `ACCESS_NETWORK_STATE`, which is used to read whether a VPN or proxy is set. Every signal is off until the app turns it on.
