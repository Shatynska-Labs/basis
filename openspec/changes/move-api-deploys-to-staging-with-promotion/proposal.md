## Why

Every merge to `main` deploys the API straight to production (`deploy-api-skeleton` design decision 8), so the first place a change runs on a real host is the place its user depends on. The operator has switched `main-staging` back on (2026-10-18) and wants a merge to deploy staging, with production reached only when the operator promotes a commit staging has already run. `Fuperia-IT/commerce-ops` already runs that shape on the same infrastructure (`docs/environments.md` decisions 1, 2, 9 and 12; `.github/workflows/promote.yml`); this change adopts it, simplified for an API with no database, before the first change with behaviour worth protecting (`identity`, `metrics`) ships. Recorded in `docs/backlog.md` as `move-api-deploys-to-staging-with-promotion`.

## What Changes

- **BREAKING (operator):** a merge to `main` no longer reaches production. `.github/workflows/deploy.yml` builds the image once and deploys it to `main-staging`, in the `staging` GitHub Environment.
- **`.github/workflows/promote.yml`**, the only path to production: `workflow_dispatch` with a full commit SHA. It refuses unless GitHub's `staging` Deployment records hold a `success` for that commit with no later `failure` or `error`, resolves the image that commit's tag points at to its digest, and deploys that digest to `main-production`. Rollback is a promotion naming an earlier commit.
- **Deploy by digest, never rebuilt**: `deploy/api/docker-compose.yml` references `ghcr.io/shatynska-labs/basis-api@<digest>`; staging receives the digest the build produced, production the digest of the commit promoted.
- **The hostname is built, not written down**: one Compose file for both hosts, its Traefik rule rendered into `.env` as `basis-api.<server>.<BASE_DOMAIN>`, with `api.basis.<BASE_DOMAIN>` kept as production's alias. No domain is a literal in the repository.
- **A delivery fails unless the public health report names the delivered commit**, on both targets. Today a mismatch is only a warning; staging's Deployment record is what a promotion trusts, so a staging deploy that is not observably running its commit must not record success.
- **`tools/delivery`**: the decisions the workflows make — the superseded-commit verdict, the staging gate, the `.env` rendering with the router rule, the check of what Compose resolves, and the health-report wait — as dependency-free TypeScript run by `node`, as `tools/change-scope` is, so they are unit-tested rather than living only in YAML. A composite action, `.github/actions/deliver-api`, joins the tailnet and delivers, shared by both workflows.
- **`AGENTS.md`**: the `ship` stage gains `deploy staging · confirm (on staging) · promote · deploy production · smoke`, as commerce-ops' does. The operator triggers the promotion; the agent proposes it and never triggers it.

Not in this change: a database or its probe, an approval rule on either Environment, preview environments, `portfolio`'s move to `MAIN_PRODUCTION_DEPLOY_HOST` (`move-portfolio-to-main-production-deploy-host`).

## Dependencies

- **Infrastructure** (`Shatynska-Labs/infrastructure`): a `basis-api` entry in `deploy_apps` of `ansible/inventory/host_vars/main-staging.yml`, deploy key comment `basis-api-deploy-main-staging` and probe key `basis-api-probe-main-staging` (unused, but the infrastructure's tests require one on every entry), merged and converged on `main-staging`. The operator generates both keys (2026-10-18). The first staging deploy cannot authenticate until it lands; nothing before task 6 waits for it.
- **Operator**: a `staging` Environment on `Shatynska-Labs/basis` holding the staging deploy key as `BASIS_API_DEPLOY_SSH_KEY`, and the deployment branches of both `staging` and `production` restricted to `main`. The organisation variables `MAIN_STAGING_DEPLOY_HOST` and `BASE_DOMAIN` already exist.

## Capabilities

### New Capabilities

- `api-delivery`: how a commit of the API reaches each host — staging on merge, production only by promotion of a commit staging ran, as the same image by digest, at a hostname built from the server and the base domain, and judged by the health report naming the delivered commit.

### Modified Capabilities

None. `api-health` is read, not changed.

## Impact

- Changed: `.github/workflows/deploy.yml`, `deploy/api/docker-compose.yml`, `AGENTS.md` (a `## Deployment` section refining `ship`; the generated workflow block is left unchanged).
- New: `.github/workflows/promote.yml`, `.github/actions/deliver-api/action.yml`, `tools/delivery` (Nx project `delivery`, tags `scope:tooling`, `type:tooling`).
- New development dependency: `yaml`, for the tests that read the workflow files.
- GitHub: a `staging` Environment; the `production` Environment keeps its deploy key and is now read only by `promote.yml`.
- Production keeps running its current commit until the first promotion, whose Traefik rule adds `basis-api.main-production.<BASE_DOMAIN>` beside `api.basis.<BASE_DOMAIN>`.
- `docs/backlog.md`: the entry `move-api-deploys-to-staging-with-promotion` is deleted when this change is archived.
