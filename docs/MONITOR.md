# Device monitor (`/monitor/`)

The device monitor is a separate static page at `/monitor/`. It reads only the device readings you switch on, seals each reading into a SHA-256 hash chain on the device, and shows whether the chain still verifies. It does not depend on the rest of AEGIS and does not change the existing routes, keys, or receipts.

## What it claims

- Readings are written in order. Each record includes the SHA-256 hash of the record before it, so an edit, a deletion, or a reorder breaks the chain at a visible point.
- The record hash covers the summary text as well as the data, so the text shown in the log cannot be changed without breaking the chain.
- Each switch change (on, off, browser refusal) is itself a record.
- A flag in the log means the page could not explain a change. It is not evidence that anyone is monitoring the device.

## What it does not claim

- It cannot prove that nobody is monitoring the device.
- A person with access to the browser's storage can delete the log and write a new chain. The chain alone cannot tell that apart from the original. The defence is the head hash: copy it to somewhere other than the device. A rewritten log will have a different head hash.
- The timestamps come from the device clock. They are not an external time source.
- Readings happen only while the page is open and visible.

## Permissions

All four switches start off. The page works with all of them off; it then only records switch changes.

| Group | Reads | Gate |
| --- | --- | --- |
| Clock agreement | Wall clock against the steady clock, once per reading | Your switch. No browser prompt exists. |
| Timer regularity | Lateness of a 200 ms timer | Your switch. No browser prompt exists. |
| Device status | Battery and charging (where shared), connection type, memory, cores, storage used by this site, screen, visibility | Your switch. Many fields are missing on iPhone and some browsers. |
| Motion | Acceleration from the motion sensor over the last 2 seconds | The browser's prompt where required (iOS), and your switch. |

If the browser refuses motion access, the refusal is logged and the switch stays off.

## Scoring layer (CC and SS)

- Consistency index μ is a weighted geometric mean, `μ = exp(Σ wᵢ ln sᵢ)`, over two scores: clock agreement (weight 0.6) and timer regularity (weight 0.4). It is computed only when both were read in the same reading.
- The scoring functions and weights are the operator's choice. They are not calibrated against a reference battery, so the page labels μ "uncalibrated".
- The threshold τ is not set. The framework requires it to come from a reference battery, and none exists. No pass or fail verdict is shown.
- Rule R(S) is taken to be "the log verifies". Gate G(S) is taken to be "consent held at every reading". The framework leaves the boundary between rules and gates to the operator, so this is a choice, and the report says so.
- The framework does not map cleanly onto device sensors. Its dimensions are defined by the operator, and the sensors have no expected values to score against. The μ shown here is a timing consistency number, not a measure of device health or of monitoring.

## Verifying a log

- **On the device:** the page checks the whole chain on load, on "Check chain now", and before export.
- **A saved export:** `Export log (.json)` writes the full chain. "Check an exported file" recomputes every hash. If you saved a head hash elsewhere, paste it into the optional field; a mismatch means the chain was rewritten.
- **By hand:** the export's `records` are plain JSON. Each `hash` is `SHA-256(canonical JSON of {seq, ts, type, summary, payloadHash, prevHash})`, and each `payloadHash` is `SHA-256(canonical JSON of payload)`. Canonical JSON sorts object keys, drops `undefined`, maps non-finite numbers to `null`, and emits no whitespace. The first record links to 64 zero characters.

## Storage and network

- Records and switch states live in this browser's IndexedDB, in a database named `aegis-monitor`. The page never writes to the AEGIS ledger database.
- The page makes no network requests beyond its own files. It loads no outside scripts, fonts, or analytics.
- The service worker is the same one the AEGIS root uses. Its precache list now includes the monitor files, and it serves `/monitor/` for monitor navigations so the page works offline after one load.

## Tests

`npm test` runs the Node test suite in `test/monitor/`: 29 tests on the hash chain (including payload, summary, timestamp, deletion, reorder, truncation, and full-rewrite cases) and on consent, gating, scoring and two-tab writes.

## Known limits and next steps

- No signature on the chain yet. The next step is to seal the head with the same ECDSA key approach used by the ledger, and to publish the head hash somewhere external.
- Motion readings depend on the browser delivering motion events; many desktop browsers never do.
- The page cannot read anything outside the browser: other apps, files, radios, camera, microphone, or location.
- No link from the existing AEGIS navigation to `/monitor/`, because the shipped bundle has no editable source in this repository.
