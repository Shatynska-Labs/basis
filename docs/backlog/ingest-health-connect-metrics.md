---
kind: change
waits_on: []
design_with: [retire-the-health-connect-intake]
workstream: reach-the-calibration-period
recorded_by: "the backlog and workstream revision of 2026-11-08"
re_checked: 2026-11-08
---

`metrics`' idempotent ingestion of Health Connect data, translated in a driving anti-corruption layer into normalized, source-agnostic metrics (`docs/product/04-domain-model.md` §1, ADR-0001, ADR-0012 §1, roadmap Phase 1). It is what Basis's own mobile client (`sync-health-connect-from-the-mobile-app`) sends to, and what replaces Phase 0's temporary intake. The Phase 0 findings in ADR-0001 record which types the reference device provides and which points are still unverified.

- **Kind**: It owes a new `metrics` ingestion capability and is too large for one review sitting.
- **Recorded by**: the backlog and workstream revision of 2026-11-08, so that `retire-the-health-connect-intake` can wait on it by name.
