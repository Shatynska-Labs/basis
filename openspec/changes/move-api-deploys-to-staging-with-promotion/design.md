## Context

`deploy-api-skeleton` left one path: CI succeeds on `main` → `deploy.yml` builds `ghcr.io/shatynska-labs/basis-api:<head_sha>` and delivers it to `main-production` in the `production` Environment, guarded against superseded commits (its design decision 8). Production answers at `https://api.basis.shatynska.com/health` with the commit it runs.

`main-staging` is on again. The infrastructure contract is per deploy target (`Shatynska-Labs/infrastructure` `docs/onboard-an-application.md`): a `deploy_apps` entry in that host's own `host_vars/main-staging.yml`, a key of its own, and an Environment of its own in this repository. Both hosts are reached the same way — the tailnet as `tag:ci` with the organisation Tailscale secrets, then `deploy@<host>` whose forced command extracts `docker-compose.yml` and `.env` into `/opt/basis-api` and runs `docker compose pull && docker compose up -d --wait`. The organisation variables `MAIN_STAGING_DEPLOY_HOST`, `MAIN_PRODUCTION_DEPLOY_HOST` and `BASE_DOMAIN` (`shatynska.com`) exist and are visible to this repository. `*.main-staging.shatynska.com` and `*.main-production.shatynska.com` resolve to their hosts. The host's image pruning resolves digest references to image identities, so a digest-pinned Compose file is protected like a tagged one (`ansible/roles/image_prune/README.md`).

`Fuperia-IT/commerce-ops` runs the target shape on the same infrastructure, and this design follows it except where named.

## Goals / Non-Goals

**Goals:**

- A merge reaches staging only; production runs only what the operator promotes, and only what staging has run, as the same bytes.
- "Staging ran it" is GitHub's record, read by the promotion, not a claim.
- Rollback is the same act as promotion.
- The decisions the workflows make are unit-tested code, not YAML.

**Non-Goals:**

- An approval rule on either Environment: triggering `promote.yml` needs write access, and that is the access control (commerce-ops decision 1 rejects an approval gate on a pending run).
- A smoke gate beyond the health report naming the commit: the API has no worker or dependency to exercise.
- A database probe. The staging entry still declares a probe key, unused, as production's does: the infrastructure repository's `.github/tests/test_a_shared_instance_reset_is_visible.py` fails any `deploy_apps` entry on either host without a `probe_public_key`, whatever its onboarding doc says about skipping one.
- Pinning third-party actions by commit; the existing workflows pin by major version.

## Decisions

### 1. Two workflows, one image

```
push main ─▶ CI ─▶ deploy.yml: build-and-push ─▶ supersession ─▶ deploy (staging)
                                   │ digest
                                   ▼
             promote.yml (workflow_dispatch, commit=<sha>) ─▶ staging gate ─▶ resolve digest ─▶ deliver (production)
```

`deploy.yml` keeps its trigger, its `build-and-push` job and its `supersession` job. `supersession` and the deploy job each check out `github.event.workflow_run.head_sha` and run `actions/setup-node` from `.nvmrc` before invoking `supersession.ts`, as `ci.yml` does before `tools/change-scope`; its `deploy` job becomes `Deploy (staging)`: `environment: staging`, concurrency group `deploy-staging`, `vars.MAIN_STAGING_DEPLOY_HOST`. `build-and-push` exposes the pushed digest (`docker/build-push-action`'s `digest` output) as a job output, which `supersession` passes on (a job reads only the outputs of the jobs it `needs`).

`promote.yml` triggers on `workflow_dispatch` alone with a required string input `commit`. One job, `Promote to production`: `environment: production`, concurrency group `deploy-production` with `cancel-in-progress: false`, `permissions: contents: read, deployments: read, packages: read`. Steps: refuse unless `github.ref` is `refs/heads/main`, and unless `inputs.commit` is a full commit SHA, both in shell before anything is checked out; check out this workflow's own commit (`github.sha`, `main`'s tip, by the first refusal) for the tooling; set up Node from `.nvmrc`; run the staging gate (decision 4); check out the promoted commit's `deploy/api` alone into `.promoted` (sparse checkout); log in to GHCR; resolve the digest with `docker buildx imagetools inspect "$IMAGE_NAME:$COMMIT" --format '{{.Manifest.Digest}}'`, refusing an empty answer by naming the commit; deliver through the shared action (decision 7) with target `production`.

**Only `main` promotes.** GitHub runs a `workflow_dispatch` from whichever ref the dispatcher selects (`gh workflow run --ref`), so without the first refusal an unreviewed branch's copy of this workflow and its tools would run under `production`'s secrets. The refusal is in the file, where `delivery-files.spec.ts` checks it; the operator also restricts both Environments' deployment branches to `main` (tasks), which closes the same hole for any other workflow a branch might add, and is not an approval rule. `deploy.yml` is unaffected: `workflow_run` always runs from the default branch.

**The Compose file is the promoted commit's; the tooling is `main`'s.** An old image under a newer Compose file is a combination nothing tested, so what reaches the host belongs to the image. How the promotion decides belongs to `main`, so a fix to a gate applies to the next promotion rather than only to commits that contain it, and promoting a commit older than a tool still finds the tool (commerce-ops `promote.yml`). Every promotable commit postdates this change, because the gate admits only commits staging ran, and staging is first deployed by it.

The production key stays where it is: `BASIS_API_DEPLOY_SSH_KEY` in the `production` Environment, now read only by `promote.yml`. Staging's key is the same secret name in the `staging` Environment, so the shared action takes one input whichever target it serves.

Rejected: an approval-gated second job in `deploy.yml` (a pending production deployment after every merge, accumulating and expiring, and no rollback); a tag or `production` branch (tempts a rebuild from source).

### 2. Deploy by digest

`deploy/api/docker-compose.yml`'s image becomes `ghcr.io/shatynska-labs/basis-api@${IMAGE_DIGEST:?IMAGE_DIGEST is not rendered}`. The tag `:<commit>` is still pushed, because it is how a promotion finds a commit's image, but nothing deploys it. A digest cannot be re-pushed, so production receives the bytes staging ran. The build's own digest output and the tag's resolution name the same object — the image index `build-push-action` pushed — unless the tag was re-pushed between the two, which needs someone re-running that commit's build.

### 3. The hostname is rendered, not written down

One Compose file for both hosts, as commerce-ops decision 9 has it, because the forced command extracts a fixed member list and an override file cannot be shipped. Its router rule becomes `traefik.http.routers.basis-api.rule=${ROUTER_RULE:?ROUTER_RULE is not rendered}`. `ROUTER_RULE` is built from three parts: the service `basis-api` (a constant of the tool), the server (`main-staging` or `main-production`, chosen by the target, a constant of the tool, never a variable: no settings edit can point one workflow at the other host's name), and `BASE_DOMAIN`, the organisation variable — read at organisation level only; a repository or Environment variable of that name would shadow it. Production adds the alias `api.basis.<BASE_DOMAIN>`, which keeps today's address working; staging has none. The alias is derived from the base domain rather than configured, because the one alias there is follows the domain, and a variable would be one more setting to keep in step.

Machine-facing checks name the technical hostname: the health wait polls `basis-api.<server>.<base domain>`. The first promotion adds that name to production's router, so Traefik requests a certificate for both names; until it is issued the wait sees a certificate error, which is why the window is about four minutes (decision 6).

### 4. The staging gate reads GitHub's own records

`environment: staging` on the deploy job makes GitHub write a Deployment for every run that reaches the job, and statuses as the job progresses, ending `success` or `failure` with the job's conclusion. The gate lists `GET /repos/{repo}/deployments?environment=staging&sha=<commit>&per_page=100`, keeps only entries whose `sha` and `environment` match (whatever the query returned), and for each reads its statuses (`per_page=100`), which GitHub serves newest first. The commit passes when any deployment's history holds a `success` with no later `failure` or `error`. Not "the latest status is `success`": GitHub may append `inactive` to a superseded deployment, and that reading would refuse every commit but the newest — the rollback path, discovered during an incident (commerce-ops' gate docstring, measured there 2026-09-15).

**The record's commit is the run's `github.sha`.** A `workflow_run` job's Deployment takes `github.sha` — the default branch's tip when the run was created — not the commit CI judged; this repository's production records confirm it (deployment 7158225445 has `sha` `497d03b…`, its run's `github.sha`). The two agree whenever the deploy job delivers, because decision 5 fails the job before delivering when they differ. The re-run exemption `deploy-api-skeleton` gave the guard is withdrawn for the same reason: a re-run keeps its original `github.sha`, so re-running a superseded commit's run would deliver one commit under another's record. Rollback no longer needs it (decision 1).

### 5. Supersession: skip early, fail late

The guard runs twice, as before. In `supersession`, before the deploy job asks for the concurrency group, a commit `main` has moved past is skipped: the deploy job is then skipped by its `if`, declares no Environment, and leaves no record — and, as before, never queues behind the group to cancel the newer commit's pending deploy. In the deploy job, once it holds the group, a commit `main` moved past while it waited now **fails** the job instead of skipping its steps. Skipping there would end the job `success` and write a staging `success` for a commit staging never ran, which the gate would then admit. Failing writes a `failure`, which the gate refuses. The cost is a red run in a rare case — a newer commit delivered while this one waited — and its error names the newer commit.

The deliver-stage verdict also fails when `github.sha` differs from the commit (decision 4). The verdict is `decide` in `tools/delivery/src/supersession.ts`; the step around it reads `main`'s head with `git ls-remote`.

### 6. The health report must name the delivered commit

The shared action's last step polls `https://<technical hostname>/health` until `version` equals the delivered commit: 18 attempts, each at most 5 seconds, 10 seconds apart, no sleep after the last — 170 seconds of sleep plus at most 90 of timeouts, so between about 2.8 and 4.3 minutes. It fails otherwise. `deploy-api-skeleton` made this a warning because DNS and the certificate did not exist yet; both now do for the technical names, and staging's record of success is what a promotion trusts. A failed promotion wait leaves production on the promoted image — the host's `--wait` has already replaced the container — and the remedy is promoting the previous commit, which is the operator's to take.

### 7. `tools/delivery` and `.github/actions/deliver-api`

A new Nx project `tools/delivery` (`@basis/delivery`, tags `scope:tooling`, `type:tooling`), laid out as `tools/change-scope` is: each script is one file importing Node built-ins only, in erasable syntax, run as `node tools/delivery/src/<script>.ts` with no install, after `actions/setup-node` from `.nvmrc` (Node 24 is needed for `import.meta.main` and type stripping), and unit-tested beside itself with Vitest. Each exports pure functions for the tests and runs as a command under `if (import.meta.main)`:

- **`supersession.ts`** — `decide({ stage, commit, head, runCommit })`, `stage` being `'skip'` or `'deliver'`, returns `{ action: 'deliver' }`, `{ action: 'skip', reason }` or `{ action: 'fail', reason }`. `runCommit` is consulted only at `'deliver'`. An empty `head` fails at either stage. Command: reads `STAGE`, `COMMIT`, `RUN_COMMIT`, `REMOTE`; runs `git ls-remote "$REMOTE" refs/heads/main`; writes `deliver=true|false` to `$GITHUB_OUTPUT`; prints the reason as a `::notice::` (skip) or `::error::` (fail) and exits `1` on fail.
- **`staging-gate.ts`** — `isCommitSha(value)`; `hasSucceeded(statuses)` over statuses as GitHub serves them, newest first, each `{ state }`; `checkStaging({ commit, repository, apiUrl, getJson })`, where `getJson(url)` resolves to the parsed body or rejects, returns `{ ok: true, deploymentId }` or `{ ok: false, reason }`, refusing a malformed `commit` before calling `getJson` and turning a rejection into a refusal. Command: reads `COMMIT`, `GITHUB_REPOSITORY`, `GITHUB_API_URL` (default `https://api.github.com`), `GH_TOKEN`; `getJson` is `fetch` with the token; exits `1` with the reason on refusal.
- **`render-env.ts`** — `renderLine(name, value)` returns `NAME="<escaped>"`; `renderEnv({ target, baseDomain, imageDigest })` returns `{ content, technicalHostname }`, `content` holding `IMAGE_DIGEST` and `ROUTER_RULE` lines and a trailing newline, or throws an `Error` whose message names `IMAGE_DIGEST`, `BASE_DOMAIN` or the target. A base domain is two or more DNS labels of lowercase letters, digits and inner hyphens. Command: reads `TARGET`, `BASE_DOMAIN`, `IMAGE_DIGEST`, `ENV_FILE`; writes `ENV_FILE` with mode `0600` only after `renderEnv` succeeded; appends `technical-hostname=<name>` and `router-rule=<rule>` to `$GITHUB_OUTPUT`; the action passes `router-rule` to `check-compose.ts` through `env:` as `ROUTER_RULE`, and the image digest it already holds as `IMAGE_DIGEST`. The escaping is the infrastructure's (`\` → `\\`, `"` → `\"`, `$` → `$$`, in that order), moved here from the workflow's shell helper.
- **`check-compose.ts`** — `checkCompose({ config, routerRule, imageDigest })`, `config` being the parsed output of `docker compose config --format json`, returns `{ ok: true }` or `{ ok: false, reason }`: it passes only when the service `api`'s image is exactly `ghcr.io/shatynska-labs/basis-api@<imageDigest>` and its label `traefik.http.routers.basis-api.rule` is exactly `routerRule`. The reason names the field, never the value, since Compose inlines the rendered `.env` into its output. Command: reads the configuration on standard input, `ROUTER_RULE` and `IMAGE_DIGEST` from the environment; exits `1` with the reason.
- **`await-version.ts`** — `awaitVersion({ url, expected, attempts, intervalMs, timeoutMs, fetch, sleep })` returns `{ ok: true }` or `{ ok: false, reason }`; `fetch` and `sleep` default to the globals and are injected by tests. An answer counts only with status `200` and a JSON body whose `version` equals `expected`. Command: reads `URL`, `EXPECTED_VERSION`, `POLL_ATTEMPTS` (default 18), `POLL_INTERVAL` seconds (default 10); exits `1` with the reason on failure.

Static checks of the workflow and Compose files (the spec's "is read" scenarios) live in `tools/delivery/src/delivery-files.spec.ts`, parsing YAML with `yaml` (a new root development dependency at an exact version) and reading the files relative to the repository root. Those files belong to no Nx project, so the `delivery` project's `test` target declares them as inputs — `{workspaceRoot}/.github/workflows/**`, `{workspaceRoot}/.github/actions/**`, `{workspaceRoot}/deploy/api/**` beside its defaults — or `nx affected`, in CI and in the hooks, would skip the checks on exactly the edits they guard.

`.github/actions/deliver-api/action.yml` is a composite action shared by both workflows, with inputs `target`, `deploy-host`, `deploy-ssh-key`, `tailscale-oauth-client-id`, `tailscale-oauth-secret`, `base-domain`, `image-digest`, `commit`, `compose-dir`. Its steps: refuse, naming each, any empty input, before joining anything; `actions/setup-node` from the tooling's `.nvmrc`; `tailscale/github-action@v4` (`tags: tag:ci`, `ping` the host); `render-env.ts` into `<compose-dir>/.env`; `docker compose -f <compose-dir>/docker-compose.yml config --format json` piped to `check-compose.ts`, before anything is delivered; key into `$RUNNER_TEMP`, `ssh-keyscan`, `tar -czf - -C <compose-dir> docker-compose.yml .env | ssh … deploy@<host>` with `StrictHostKeyChecking=yes`, unchanged from `deploy-api-skeleton`; `await-version.ts` against the output technical hostname. Every input reaches a `run:` body through `env:`; none is substituted into one. The tooling paths are resolved from `${{ github.action_path }}`, so the action finds its scripts in whichever checkout it was loaded from. A composite action rather than two copies, because the delivery is the part that must not drift between the two targets.

### 8. `AGENTS.md`

The workflow rules assume one deploy triggered by merging; they now describe two hosts. In the opening, "nothing reaches production except by merging" becomes "nothing reaches staging except by merging, nor production except by the operator promoting a merged commit", and the assumptions name "a staging deploy triggered by merging to the trunk and an operator-triggered promotion to production". The `ship` line becomes `open pr · merge · deploy staging · confirm · promote · deploy production · smoke · archive`, and the `ship` section takes commerce-ops' text for those steps, without its prompt-publishing paragraph: never run the deploy command against a host, a change reaching staging by merging and production by a promotion the operator triggers; triggering a workflow is not deploying, and the agent proposes a promotion and never triggers one; `confirm` is on staging; production's gate is the promotion's health wait, reported by the operator; a failed wait re-enters at `build`'s review, its immediate remedy promoting the previous commit; `archive` waits until the change is in production, and a change deliberately not promoted — a documentation-only merge — is archived on the operator's word as a waiver of `promote`. `smoke` here is the operator reporting that the promotion's health wait passed; there is no other smoke check (Non-Goals). The new states are `ship:staging-deployed`, `ship:promoted`, `ship:production-deployed` and `ship:smoked`, and the sentence "Two reorder: `plan:tests-derived` and `ship:pr-open`" is updated to name the two new reorderings, `ship:staging-deployed` and `ship:production-deployed`.

## Risks / Trade-offs

- [The staging host cannot pull the image: the `basis-api` package is private] → The host's GHCR identity needs read access, as production's has; the first `docker compose pull` fails loudly. Recorded as an operator step (tasks).
- [The first promotion's certificate takes longer than the wait] → The wait fails while the container is healthy; the operator re-runs the promotion, which redelivers the same digest and waits again.
- [A merge to `main` that changes only documentation is deployed to staging and never promoted] → Correct, not drift: production sits behind `main` by such commits.
- [A red deploy run when a newer commit delivered during the wait] → Decision 5; its error names the newer commit.
- [GitHub stops writing Deployments for `workflow_run` jobs, or changes their `sha`] → The gate refuses every promotion rather than admitting one; nothing is delivered on a missing record.
- [`promote.yml` runs from the default branch, so a pull request changing it is not exercised before merge] → Tasks run its first promotion after merge, and its tools are unit-tested before.

## Migration Plan

1. Infrastructure: the `basis-api` entry in `main-staging.yml`, merged and converged on `main-staging`.
2. Operator: the `staging` Environment with `BASIS_API_DEPLOY_SSH_KEY`; GHCR read access for the staging host if its first pull is refused.
3. This change merges; `deploy.yml` deploys staging; production keeps its current commit.
4. The operator promotes the merge commit; production gains `basis-api.main-production.shatynska.com` beside `api.basis.shatynska.com`.

**Rollback** of this change: revert and merge, which restores the production deploy on merge; the `staging` Environment and the staging entry can stay.

## Open Questions

None.
