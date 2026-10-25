# Framework: Coherence Calculus and System Sanity, Version 3

This document summarizes the author's published framework and records where the shipped code diverges from it. The framework text is not included in this repository. The summary below is limited to the definitions and section claims supplied with this repository's documentation task; it is not a substitute for the framework text.

## Summary

- **Coherence** is a weighted geometric mean over `N ≥ 2` dimensions:

  ```
  μ(S) = exp( Σ_i w_i · ln s_i )
  ```

  with weights `w_i` summing to 1 and each `s_i` a normalised dimension score.

- **Sanity** is the predicate:

  ```
  sanity(S) = (μ(S) ≥ τ) ∧ R(S) ∧ G(S)
  ```

- **§4.4 gate test.** A dimension that cannot be gated is decorative.
- **§4.2.** `τ` must be derived empirically from a reference battery, never chosen by feel.
- **§10.1.** A system with deliberately dishonest domain definitions is indistinguishable from an honest one from inside the framework.
- **§10.2.** Cryptographic integrity is not substantive integrity. An audit trail and external anchoring can make the record verifiable, not the content accurate.
- **§10.6.** HALT is inoperable for a system that cannot stop, so it can only mean escalate to human authority. AEGIS is an observer with no operational gate, so this is moot.

## KNOWN DIVERGENCES

| Shipped behaviour | Framework requirement | Status |
| --- | --- | --- |
| The MIND scorer computes `μ = Σ(score_i · weight_i) / Σ(weight_i)` over measured domains — a weighted arithmetic mean. | `μ(S) = exp(Σ w_i · ln s_i)`, a weighted geometric mean over `N ≥ 2` dimensions with weights summing to 1. | **Not implemented.** The shipped formula is arithmetic, not geometric. |
| `τ` is not empirically calibrated from a reference battery. The app uses fixed decision thresholds: anomaly > 0.80 and `μ` < 0.95 → `QUARANTINE`; anomaly > 0.50 → `WATCH`; otherwise `ALLOW`. | §4.2: `τ` must be derived empirically from a reference battery, never chosen by feel. | **Not done.** No reference battery or empirical `τ` is present in the source. |
| There is no external timestamp authority or third-party anchor. Record times come from the device clock. The app offers a human anchor procedure on `/clock` and an anchor digest for off-device publication. | §10.2: cryptographic integrity is not substantive integrity; independent time/anchoring is required for the record to be independently dateable. | **Mitigated only by a human anchor procedure, not solved.** |
| The app computes `μ` and a separate `anomaly` score with an `ALLOW` / `WATCH` / `QUARANTINE` decision. It does not compute `sanity = (μ ≥ τ) ∧ R(S) ∧ G(S)`. | Sanity is the predicate `(μ ≥ τ) ∧ R(S) ∧ G(S)`. | **Not implemented.** `R(S)` and `G(S)` are absent from the source. |
| The six domains are redefined as instrument domains E / L / S / F / V / D with weights 0.30 / 0.30 / 0.15 / 0.10 / 0.08 / 0.07. The app's own `/mind` page says the document's six aesthetic domains are redefined here as instrument domains, keeping the same letters and the same weights. | The framework's domain definitions are the author's. | **Diverges.** The framework's original domain definitions are not in this repository; the shipped definitions are a redefinition. |
| When fewer than six domains are measured, the shipped `μ` renormalises the weights over the measured domains. | The framework specifies weights summing to 1 over `N ≥ 2` dimensions; the summary supplied here does not define a renormalisation rule for missing dimensions. | **Diverges in partial-coverage cases.** The app labels partial coverage as `PARTIAL (n/6 · w% weight)`. |
| No HALT control exists. The app is an observer with no operational gate. | §10.6: HALT is inoperable for a system that cannot stop; it can only mean escalate to human authority. AEGIS is an observer, so this is moot. | **Moot / not applicable.** No HALT is implemented. |
| The app's `R(S)` and `G(S)` terms are not implemented. | The sanity predicate includes `R(S)` and `G(S)`. | **Not implemented.** |

## Source references

- The arithmetic `μ` and the six weights: `public/assets/index-CL6IUdNY.js`.
- The `/mind` page's statement that the six aesthetic domains are redefined as instrument domains: `public/assets/mind-BTRhqqfo.js`.
- The decision rule: `public/assets/mind-BTRhqqfo.js` and `public/assets/index-CL6IUdNY.js`.
- The human anchor procedure: `public/assets/clock-sWdOvu5h.js`.
- The verifier's anchor-digest check: `public/assets/verify-KPAhcwj-.js` and `public/assets/index-CL6IUdNY.js`.
