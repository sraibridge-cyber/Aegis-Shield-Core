# AEGIS

AEGIS is a local, offline-capable browser application for recording observations and sealing them on the device that runs it. It has 15 routes, no server, no account, and no vendor key. The running app is the static bundle in `public/`; the `src/` directory is the Vincen template scaffold and is not part of the AEGIS runtime.

## What this is

AEGIS is a static, local-first browser instrument for recording observations and sealing them on the device that runs it. It has 15 routes, no backend, no account, and no vendor key. The runtime is a prebuilt static bundle in `public/assets/`; the repository also contains the Vincen template scaffold in `src/`, which is not part of the AEGIS runtime.

The app writes a SHA-256 hash chain in IndexedDB, rolls the record hashes into a Merkle root, signs checkpoint roots with ECDSA P-256, and can encrypt the local ledger, baseline and settings with AES-GCM-256 under a PBKDF2-SHA256 key. It can export a JSON evidence pack, an `AFFIDAVIT.txt`, and standalone checkpoint receipts. A third party can load a pack or receipt in `/#/verify` and recompute the chain, the Merkle root, the signatures, the embedded key fingerprint and the anchor digest without the exporter's device.

The app's own `/free` page says "no telemetry" and "Nothing phones home". That statement is true of a clean build from this repository. It is not true of the vendor-hosted copy, which injects the beacons named under "Vendor-hosted copy vs a reproducible build" below.

## What it is not

- It does not detect surveillance.
- It does not block, jam, spoof, or transmit anything. It emits no counter-signal or other radio output of its own; the only radio activity is the browser's Bluetooth connection when the user explicitly selects a device.
- It does not prove that any person or device was observed.
- It does not establish admissibility in any legal proceeding.
- It is not a certification of security, compliance, or safety.
- It does not attest to the trustworthiness of the device, browser, operating system, or extensions it runs on. A passing self-test proves only that specific code paths returned specific values in that browser at that moment.
- It does not provide a recovery service. There is no account, no vendor key, and no server-side copy.
- It does not make the vendor-hosted copy beacon-free. The vendor-hosted copy injects the beacons listed below; a clean build from this repository does not.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Hull console: device and declared siblings, hull fingerprint, five-layer stack, session audit. |
| `/nerve` | Passive observation: browser-exposed sensors, session events, optional user-selected Bluetooth; detection only. |
| `/mind` | Resonance calculus: six-domain `μ`, domain contributions, anomaly score, adaptive baseline. |
| `/memory` | Merkle Bonsai ledger: records, checkpoints, receipts, tamper lab, export. |
| `/soul` | Vault and seal keys: Seal A, Seal B keeper, passphrase, rotation, local wipe. |
| `/verify` | Third-party verifier: load a pack or receipt and recompute chain, Merkle root, signatures, fingerprint, anchor. |
| `/clock` | The one flaw: clock caveat, clock watch, human anchor protocol, attestation form. |
| `/free` | Distribution and provenance: cost, distribution, install, honest limits. |
| `/install` | Install from the browser: Android/Chrome, iOS/Safari, desktop, offline proof. |
| `/wiring` | Doctrine: what is actually wired, dual seal, five layers, platform limits. |
| `/selftest` | Self-test console: 41 checks with measured values. |
| `/self-test` | Alias of `/selftest`; same component. |
| `/guide` | Plain-language field guide: one record from measurement to export. |
| `/instance` | Instance identity: hull id, reset boundary, key rotation, backup status. |
| `/recovery` | Recovery cases: keeper lost, browser data cleared, both lost. |

Routes are hash routes. `index.html` rewrites known pathnames to hashes, so `/#/nerve` and `/nerve` open the same page.

## Run it in a browser

Build first, then serve the built folder:

```bash
pnpm install --frozen-lockfile
pnpm build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. It must be served, not opened as a `file://` URL, because Web Crypto and the service worker require HTTPS or localhost.

The repository root is not directly serveable: `index.html` references `./assets/...`, and the assets live under `public/assets/`. The build copies them into `dist/`, which is the folder to serve.

## Install to a home screen

- **Chrome / Android:** open the served page and use the browser's install action. Chrome only offers the install prompt after the page has loaded successfully at least once.
- **iOS / Safari:** Share → Add to Home Screen.
- **Desktop:** use the install icon in the address bar where the browser exposes it.
- The app registers `service-worker.js` on load and caches the app shell. After the first successful load, the app can run with the network off. The first load itself needs the network.

## Run fully offline after one load

1. Serve the built `dist/` over HTTPS or localhost.
2. Load the page once with the network on and wait for the service worker to activate. The self-test's "Service worker registration" check reports the active registration.
3. Switch the network off and reload. The service worker serves the cached shell.
4. The app's own code makes no outbound request. The browser may still make its own requests (favicon, DNS, update checks) outside the app's control.

## Build from source

```bash
pnpm install --frozen-lockfile
pnpm build
```

Output: `dist/` (36 files after the host beacons are removed). The build copies the prebuilt AEGIS bundle from `public/` into `dist/` and transforms the root `index.html`. It does not compile the React template in `src/`; the root `index.html` loads `./assets/index-CL6IUdNY.js` directly. The `src/` tree is the Vincen template scaffold (React 19 + Vite + TanStack Router + Neon) and is not part of the AEGIS runtime. The AEGIS app's editable source is not in this archive; the bundle is the only AEGIS implementation present.

## Self-host

The built `dist/` is static files. Any static host works: GitHub Pages (the recommended primary address), an object store, or any web server. There is no server-side component. For GitHub Pages, publish the contents of `dist/` to a `gh-pages` branch or a `/docs` folder and enable Pages for that source. The repository root is not the deployable root; `dist/` is.

## Vendor-hosted copy vs a reproducible build

The vendor-hosted copy is the same static bundle plus host-injected telemetry:

- an inline `navigator.sendBeacon('/__va', ...)` script in `index.html`, firing on `visibilitychange` and `pagehide`;
- `__vincen__/collector.js`, which beacons page loads, SPA route changes, JS errors, and failed backend requests to `/__vincen__/log`;
- the vendor host may also inject `window.__VINCEN__` at publish time outside this repository.

A clean build from this repository removes the first two. The third is outside the repository and cannot be removed here. The app's own `/free` page says "no telemetry" and "Nothing phones home"; that statement is true of a clean build from this repository, not of the vendor-hosted copy. The AEGIS bundle in `public/assets/` is unchanged; the difference is the host injection.

## Known divergences from the framework

The shipped MIND scorer computes a weighted arithmetic mean, not the framework's weighted geometric mean. τ is not empirically calibrated from a reference battery. There is no external timestamp authority or third-party anchor, so dates rest on the device clock; the human anchor procedure on `/clock` mitigates this but does not solve it. The app does not compute the framework's `sanity = (μ ≥ τ) ∧ R(S) ∧ G(S)` predicate; it computes `μ` and a separate `anomaly` score with an `ALLOW/WATCH/QUARANTINE` decision. The six domains are redefined as instrument domains. See `docs/FRAMEWORK.md` for the full table.

## Licence

MIT. Copyright (c) 2026 Complex System Sanity Labs / Kyle S. Whitlock. See `LICENSE`.

## Closing limitations

AEGIS records observations and seals them on the device that runs it. It does not detect surveillance, block or jam anything, or transmit anything. A verification pass proves only that the records have not changed since sealing on that device; it does not prove the observations were true, when they happened, or that the device was uncompromised. The device clock is not an external timestamp authority. A clean build from this repository contains no host beacons; the vendor-hosted copy does, and the app's own "no telemetry" statement is true only of the clean build. If you need a copy you can inspect, build it from this repository and compare the files.
