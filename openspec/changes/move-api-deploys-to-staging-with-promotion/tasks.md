## 0. Before apply

The plan is committed, then tests are derived from `specs/api-delivery/spec.md` by an author other than the implementer, before implementation starts: unit tests beside each `tools/delivery/src/<script>.ts` against the interfaces design decision 7 names, and `tools/delivery/src/delivery-files.spec.ts` for the scenarios that read the workflow and Compose files. That author also creates the `tools/delivery` project shell the tests need to run (`package.json`, `tsconfig*.json`, `vitest.config.mts`, `eslint.config.mjs`, copied from `tools/change-scope`) and adds `yaml` as a root development dependency, so the implementer conforms to the tests rather than adapting them. The infrastructure entry and the `staging` Environment (proposal, Dependencies) are the operator's; tasks 1–5 do not wait for them, task 6 does.

## 1. `tools/delivery`

- [x] 1.1 Verify the project shell: `pnpm nx show project delivery` lists `lint`, `typecheck` and `test`, its `test` inputs include the three workspace paths design decision 7 names, `pnpm nx sync:check` passes, and the derived tests fail only for want of the scripts. With only `.github/workflows/deploy.yml` edited (uncommitted), `pnpm nx show projects --affected --base=HEAD` lists `delivery`; revert it.
- [x] 1.2 Write `supersession.ts`, `staging-gate.ts`, `render-env.ts`, `check-compose.ts` and `await-version.ts` (design decision 7), Node built-ins only and erasable syntax; verify `pnpm nx run-many -t lint typecheck test -p delivery` passes.
- [x] 1.3 Verify each runs as a command with no install: from a directory holding only a copy of `tools/delivery/src` and `.nvmrc`, `node render-env.ts` with `TARGET=production BASE_DOMAIN=example.org IMAGE_DIGEST=sha256:<64 hex> ENV_FILE=./.env GITHUB_OUTPUT=./out` writes `.env` mode `0600`, and `./out` holds `technical-hostname=basis-api.main-production.example.org` and `router-rule=` followed by the production rule; with `BASE_DOMAIN=` it exits non-zero naming `BASE_DOMAIN` and no `.env` exists.
- [x] 1.4 Verify the supersession command against this repository: `STAGE=deliver COMMIT=<an older main commit> RUN_COMMIT=<same> REMOTE=<origin url> node tools/delivery/src/supersession.ts` exits `1` with an `::error::` naming the current head; with `STAGE=skip` it exits `0` with a `::notice::` and `deliver=false`; with `COMMIT` and `RUN_COMMIT` the current head, `deliver=true` at both stages.
- [x] 1.5 Verify the staging gate against GitHub, read-only: `COMMIT=<497d03b's full SHA> GITHUB_REPOSITORY=Shatynska-Labs/basis GH_TOKEN=$(gh auth token) node tools/delivery/src/staging-gate.ts` refuses (that commit has a `production` record and no `staging` one); with `COMMIT=main` it refuses before any request.

## 2. Compose file

- [x] 2.1 Change `deploy/api/docker-compose.yml`'s image to `ghcr.io/shatynska-labs/basis-api@${IMAGE_DIGEST:?…}` and its router rule to `${ROUTER_RULE:?…}`, updating its header comment (design decisions 2, 3); verify the derived file checks pass, and `docker compose -f deploy/api/docker-compose.yml config` with the `.env` from 1.3 copied into `deploy/api/` (git ignores it) resolves the image to that digest and the rule to both production hosts, and without it fails naming `IMAGE_DIGEST`; remove the copy.

## 3. `.github/actions/deliver-api`

- [x] 3.1 Write `action.yml` (design decision 7); verify `actionlint` accepts the workflows using it, and no `${{ inputs.* }}` or `${{ secrets.* }}` appears in any `run:` body (`yq '.runs.steps[].run // ""' .github/actions/deliver-api/action.yml | grep -n '\${{'` prints nothing).
- [x] 3.2 Verify the Compose resolution check against the real file: with the `.env` from 1.3 in `deploy/api/`, `docker compose -f deploy/api/docker-compose.yml config --format json | ROUTER_RULE=<the rendered rule> IMAGE_DIGEST=<the digest> node tools/delivery/src/check-compose.ts` exits `0`, and with `ROUTER_RULE` altered exits non-zero naming the router rule and printing no value from the configuration; remove the copy.

## 4. Workflows

- [x] 4.1 Change `deploy.yml` (design decisions 1, 4, 5): `build-and-push` outputs the digest; `supersession` and `Deploy (staging)` each check out `head_sha` and set up Node from `.nvmrc` before the guard; `supersession` runs `supersession.ts` at stage `skip` and passes the digest on, `Deploy (staging)` declares `environment: staging` and group `deploy-staging`, runs `supersession.ts` at stage `deliver` with `RUN_COMMIT: ${{ github.sha }}` first, and delivers through the action with `vars.MAIN_STAGING_DEPLOY_HOST`; the re-run exemption is gone. Verify `actionlint` reports nothing, the derived file checks pass, and `github.sha` appears in it only as `RUN_COMMIT`.
- [x] 4.2 Write `promote.yml` (design decision 1), its first step refusing any `github.ref` but `refs/heads/main` and a malformed `commit` before any checkout; verify `actionlint` reports nothing, the derived file checks pass, and the ref refusal's script, run locally with `GITHUB_REF=refs/heads/other`, exits non-zero naming the ref.
- [ ] 4.3 Verify the image job in `ci.yml` and the `check` job still pass on this change's pull request, with `delivery` among the affected projects.

## 5. `AGENTS.md`

- [x] 5.1 Add the `## Deployment` section below the generated workflow block, leaving the block unchanged, as design decision 8 describes; verify `pnpm format:check` passes and the section names the operator, never the agent, as who triggers a promotion.

## 6. First staging deploy and first promotion (needs the infrastructure entry and the `staging` Environment)

- [ ] 6.1 The operator confirms the `basis-api` entry in `main-staging.yml` merged and converged, the `staging` Environment holds `BASIS_API_DEPLOY_SSH_KEY`, and both Environments' deployment branches are restricted to `main` (`gh api repos/Shatynska-Labs/basis/environments --jq '.environments[] | [.name, .deployment_branch_policy]'`).
- [ ] 6.2 The operator merges this change's pull request. Observe: the Deploy run's `Deploy (staging)` job succeeds, its wait reports `basis-api.main-staging.shatynska.com` answering with the merge commit, and `gh api 'repos/Shatynska-Labs/basis/deployments?environment=staging'` holds a deployment of that commit whose latest status is `success`. Nothing was delivered to production: `https://api.basis.shatynska.com/health` still reports `497d03b…` or whatever it reported before the merge. If the first pull is denied, the operator grants the staging host read access to the `basis-api` package and re-runs the job.
- [ ] 6.3 Propose the promotion of the merge commit; the operator runs it (`gh workflow run promote.yml -f commit=<sha>`). Observe: the gate admits it naming the staging deployment, the job resolves a digest equal to the one staging deployed, and both `https://basis-api.main-production.shatynska.com/health` and `https://api.basis.shatynska.com/health` report the merge commit.
- [ ] 6.4 Observe the gate refusing: the operator runs `promote.yml` with a commit `main` holds that staging never ran (the parent of the merge commit, if it has no staging record); the run fails at the gate and production still reports the merge commit.
- [ ] 6.5 Delete `move-api-deploys-to-staging-with-promotion` from `docs/backlog.md` in the archive pull request.
