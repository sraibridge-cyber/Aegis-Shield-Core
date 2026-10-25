# Verification

This document describes what the third-party verifier in `/#/verify` recomputes, and what a passing result does and does not establish. The verifier is implemented in `public/assets/verify-KPAhcwj-.js` with the ledger and crypto helpers in `public/assets/index-CL6IUdNY.js`.

## What the counterparty needs

- **A single receipt** (`kind: "aegis.receipt"`), or
- **An export pack** (`kind: "aegis.export"`), optionally with its `AFFIDAVIT.txt`.
- **The published key fingerprint**, if they want to compare it against a value they received through a separate channel. The fingerprint is embedded in the receipt or pack; the separate copy is what makes the comparison meaningful.

A receipt is the smaller artifact and the stronger test: it carries the checkpoint, the record hashes, the Seal A signature (and Seal B when present), and the embedded public keys. A pack carries the full record list, the checkpoint list, the live and checkpoint Merkle roots, the provenance block, the affidavit and the anchor digest.

## No local state

The verifier reads only the file provided. It does not read the local ledger, keys or IndexedDB. A pack from another device is the intended test.

## What the verifier recomputes

- **Record hash.** `SHA-256(canonicalJson({seq, ts, type, payloadHash, prevHash}))` must equal the stored `hash`.
- **Payload hash.** `SHA-256(canonicalJson(payload))` must equal the stored `payloadHash`.
- **Hash-chain continuity.** Each record's `prevHash` must equal the previous record's `hash`; the first record must link to 64 zero characters.
- **Sequence continuity.** `seq` must run `1..n` with no gaps.
- **Merkle root.** The records' hashes are rolled up pairwise; an odd leaf is promoted unchanged. The recomputed root must equal the checkpoint's `rootAtSeal` / `merkleRoot`.
- **Seal A signature.** ECDSA P-256 verification over the UTF-8 bytes of the Merkle root hex string, against the embedded public key.
- **Seal B signature**, when present. The same check against the second embedded public key.
- **Embedded key fingerprint.** The fingerprint derived from the embedded public key must match the fingerprint stored in the checkpoint or pack.
- **Checkpoint chain.** Each checkpoint's `prevCheckpointRoot` must match the previous checkpoint's root.
- **Anchor digest.** `SHA-256` over the canonical JSON of the receipt or pack with the `anchor` field excluded (and, for a pack, `affidavit` excluded as well) must equal the stored `anchor`.
- **Expected digest**, if supplied. The verifier compares the computed anchor against the value the counterparty recorded independently.

The canonical JSON rule is: object keys sorted, `undefined` omitted, non-finite numbers rendered as `null`, no whitespace.

## What a passing result establishes

A passing verification establishes that the records have not changed since the checkpoint was sealed, and that the signatures were produced by the keys embedded in the artifact. It does not establish that the observations were true, that any person or device was present, or that the device clock was correct.

The timestamp becomes independent only when the anchor digest is published somewhere off the device — a public post, a timestamping service, a message to a third party, or a printed copy held by someone else. The publication is what a later reader can compare against. Without it, the date rests on the device that produced it.

## What it does not establish

- **The device clock is not an external timestamp authority.** Recorded times are only as trustworthy as the device.
- **A pack from another instance reports as such.** The verifier compares the embedded key fingerprint and reports a different-instance notice when the pack was sealed under another hull id.
- **Nothing here establishes admissibility.** A verification pass is not a legal determination.
- **A device owner can rebuild the chain and re-sign it with Seal A.** The local chain alone cannot distinguish that from the original. A receipt that already left the device, and an anchor digest published independently, are the defense.
- **The verifier does not prove the device was uncompromised.** It proves integrity since sealing, not the state of the device before sealing.
- **The verifier does not prove the browser's own integrity.** A browser self-test cannot attest to the browser.

## Honest boundary

Cryptographic integrity establishes that the records have not changed since sealing. The anchor publication is what makes the timestamp independent. Neither establishes that the content is accurate.
