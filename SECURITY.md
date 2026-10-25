# Security policy and threat model

## Assets

- **The local chain.** The records in IndexedDB (`aegis` → `state`), their payloads, and the checkpoint list.
- **The Seal A key.** An ECDSA P-256 private key generated with `extractable: false`. It signs checkpoint Merkle roots. It cannot be exported or backed up.
- **The Seal B keeper file.** An optional second ECDSA P-256 key. Its private key is exported only inside a passphrase-encrypted envelope (`format: "aegis44-keeper"`, version 1, PBKDF2-SHA256 310,000 iterations, AES-GCM).
- **Exported packs and receipts.** JSON files (`kind: "aegis.export"` and `kind: "aegis.receipt"`) plus the `AFFIDAVIT.txt` that accompanies a pack. These are the only copies that survive clearing site data.

## What the design resists

- **Accidental or partial edits to a sealed chain.** Each record hash covers `seq`, `ts`, `type`, `payloadHash` and `prevHash`. The verifier recomputes every record hash, every previous-hash link, sequence continuity, the Merkle root, and the Seal A signature (and Seal B when present). A changed payload, a deleted record, a reordered pair, or an altered signature is named at the record where it breaks.
- **Copying the chain without the key.** A copy of the records alone does not carry the Seal A private key. A verifier checks signatures against the embedded public key and fingerprint.
- **A rewritten chain presented as the original.** This is only partly resisted. A party who controls the device can rebuild the whole chain and re-sign it with the device's own Seal A key. What they cannot reproduce is a receipt that already left the device, or a match against an anchor digest that was published independently before the rewrite. That is why off-device receipts and an independently published anchor digest carry the weight, not the local chain alone.
- **A pack from a different instance.** The verifier compares the embedded key fingerprint and reports a different-instance notice when the pack was sealed under another hull id.

## What the design does not resist

- A compromised operating system, browser, or browser profile.
- A malicious browser extension with access to the page or to IndexedDB.
- Physical access to the device, including an attacker who can read storage or observe the passphrase.
- An alteration made after export. Once a pack or receipt is outside the app, its integrity depends on where it was stored and who handled it.
- A device clock set to a false time before sealing. The app records the device clock; it does not obtain an external timestamp.
- A party who convinces a verifier to trust a key they supplied rather than the fingerprint the exporter published.

## What a verification pass proves

A passing verification establishes that the records have not changed since the checkpoint was sealed, and that the signatures were produced by the keys embedded in the artifact. It does not establish that the observations were true, that any person or device was present, that the device clock was correct, or that the device was uncompromised. It does not establish admissibility in any legal proceeding.

The timestamp becomes independent only when the anchor digest is published somewhere off the device. The publication is what a later reader can compare against. Without it, the date rests on the device that produced it.

## Browser self-test

A browser self-test cannot attest to the browser's own integrity. A passing self-test proves only that specific code paths returned specific values in that browser at that moment. It does not prove the device is uncompromised, does not prove the ledger will be accepted as evidence, and does not prove anything about whether the device is being observed.

## Telemetry

A clean build from this repository contains no host-injected beacons. The vendor-hosted copy injects an inline `navigator.sendBeacon('/__va', ...)` script and a `__vincen__/collector.js` that beacons page loads, route changes, JS errors and failed requests to `/__vincen__/log`. The vendor host may also inject `window.__VINCEN__` at publish time outside this repository. The app's own `/free` page says "no telemetry" and "Nothing phones home"; that statement is true of a clean build from this repository, not of the vendor-hosted copy. See `README.md` and `REPO-HONESTY-REPORT.md`.

## Reporting a vulnerability

Report security issues privately to: **security@example.com** — replace this placeholder with the maintainer's address before publishing.

Include the affected route, the browser and version, the steps to reproduce, and whether the issue affects the local chain, the Seal A key, the Seal B keeper file, or an exported pack. Do not include real evidence packs or passphrases in a report.
