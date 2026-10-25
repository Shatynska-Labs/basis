---
kind: change
waits_on: []
design_with: []
recorded_by: scope-the-secret-scan-to-its-own-history
re_checked: 2026-10-24
---

The pre-commit hook runs `gitleaks` only if it is on `PATH` and otherwise skips with a note (`.husky/pre-commit`), and `AGENTS.md`'s Provisioning lists it as optional, so a made-up secret in a test fixture is first caught by CI's `secrets` job after it is pushed, as the fixtures of `keep-query-parameters-out-of-defect-logs` were. Decide whether `gitleaks` becomes a required provisioning step, pinned to the version CI checks against its checksum, and whether the hook then fails rather than skips when it is missing.

- **Kind**: It needs the operator's decision on making a local tool mandatory for every working tree.
- **Recorded by**: `scope-the-secret-scan-to-its-own-history`, whose entry suggested it; it changes provisioning and the hook, not CI's scan scope.
