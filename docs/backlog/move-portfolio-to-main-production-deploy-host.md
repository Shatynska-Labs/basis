---
kind: fix
waits_on: []
design_with: []
recorded_by: deploy-api-skeleton
re_checked: 2026-10-19
---

`Shatynska-Labs` holds main-production's tailnet address twice: the organisation variable `DEPLOY_HOST`, which `portfolio`'s deploy reads, and `MAIN_PRODUCTION_DEPLOY_HOST`, named for its host so that more hosts can follow, which Basis reads (`deploy-api-skeleton` design decision 8). Move `portfolio`'s deploy to `vars.MAIN_PRODUCTION_DEPLOY_HOST`, confirm a deploy through it, then delete `DEPLOY_HOST` from the organisation after checking nothing else reads it. The change belongs to the `portfolio` repository; it is recorded here because Basis's change surfaced it. **It must not** delete `DEPLOY_HOST` before `portfolio` reads the new name, or `portfolio`'s deploy breaks.

- **Kind**: made in `Shatynska-Labs/portfolio`, then an organisation-variable deletion.
- **Waits on**: `MAIN_PRODUCTION_DEPLOY_HOST` now exists in the organisation; `portfolio`'s `deploy.yml` still reads `vars.DEPLOY_HOST`.
- **Recorded by**: the session that opened `deploy-api-skeleton`, when the operator chose organisation-level deploy settings; it is another repository's work.
