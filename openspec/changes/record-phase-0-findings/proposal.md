## Why

Roadmap Phase 0 exists to learn which metrics the reference device (Galaxy Watch through Samsung Health) actually writes to Health Connect before Phase 1's ingestion and the habit rules are built on them. `validate-health-connect-data` shipped a temporary intake fed by HC Webhook, but the bridge closes whenever its list of data types is edited, so heart rate, sleep and exercise never reached the intake, and the operator chose not to spend time fixing a throwaway tool (2026-10-25). Health Connect's own data view on the phone answers most of what the intake was for, so the findings are recorded from it and Phase 0 closes. Work then moves on to Basis's own client in `reach-the-calibration-period`.

**Workstream**: `validate-the-data-source`, whose last step this is.

## What Changes

- **ADR-0001 is confirmed**, and a section records Phase 0's findings, their source (the operator's inspection of Health Connect on the reference device, 2026-10-25, not the intake's summary) and what they leave unverified.
- **`docs/product/06-risks-and-open-questions.md`**: open question 1 is answered; open question 2 (strength workout detection) stays open and is owed by `sync-health-connect-from-the-mobile-app`'s verification on the reference device; risk R1 stays Medium and its mitigation is revised.
- **`validate-the-data-source`'s Done when** is revised to require only open question 1, since the operator deferred open question 2 (2026-10-25). The workstream is archived with this change's record.
- **`reach-the-calibration-period`** names open question 2 and the other unverified points (heart-rate sample density, resting heart rate, the writer per type, the full set of sleep stages, record shapes, resends, latency) as owed by `sync-health-connect-from-the-mobile-app`.
- **`docs/backlog.md`**: `record-phase-0-findings` is closed; `retire-the-health-connect-intake` and `issue-ingestion-keys` no longer wait on or design with it.
- **`docs/product/05-roadmap.md`** Phase 0 points at the archived workstream.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change edits documentation only, so it declares `skip_specs: true`.

## Impact

- `docs/adr/0001-health-connect-as-data-source.md`, `docs/product/06-risks-and-open-questions.md`, `docs/product/05-roadmap.md`, `docs/workstreams/`, `docs/backlog.md`.
- No code, test or deployed behaviour changes. The temporary intake stays until `retire-the-health-connect-intake`. Every changed path is Markdown or YAML under `openspec/`, so the project checks stand down.
