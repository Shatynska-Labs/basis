## 0. Before apply

The plan is committed, then tests are derived from `specs/api-health/spec.md` into `apps/api-e2e/src/health.spec.ts` (design decision 4) by an author other than the implementer, before implementation starts. That author also writes the test harness the derived tests use — `apps/api-e2e/src/support/api-process.ts`, which starts the built API (`apps/api/dist/main.js`) as a child process on a free port with `APP_VERSION` set, set empty, or removed from the inherited environment, waits for `/health`, and stops it with `SIGTERM` — so the implementer conforms to the tests' interface rather than adapting the tests. The infrastructure-side change (proposal, Dependencies) is opened in `Shatynska-Labs/infrastructure` and carried there; tasks 1–5 do not wait for it, task 6 does.

## 1. `apps/api`

- [x] 1.1 Add the NestJS 12 runtime packages (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`) and the development packages (`supertest`, `@types/supertest`, `unplugin-swc`, `@swc/core`, `@swc/cli`) at exact versions old enough for pnpm's minimum release age, and add `@swc/core` to `allowBuilds`; verify `pnpm install --frozen-lockfile` on a clean `node_modules` prints no ignored-build warning and `pnpm audit --audit-level high` passes.
- [x] 1.2 Create `apps/api` as workspace package `api` tagged `type:app`, `scope:api`, with `tsconfig*.json` enabling `experimentalDecorators` and `emitDecoratorMetadata`, an `.swcrc` with legacy decorators, decorator metadata and `externalHelpers: false`, a `build` target on `@nx/js:swc` writing `dist/`, and Vitest through `unplugin-swc` (design decision 3); verify `pnpm nx show project api` lists `build`, `lint`, `typecheck` and `test`, and `pnpm nx sync:check` passes.
- [x] 1.3 Write `main.ts` (listens on `PORT`, default `3000`; `enableShutdownHooks()`), the root module and `src/health/` with the controller answering `GET /health` with `{ status: 'ok', version }`, `version` read once from `APP_VERSION` and `"unknown"` when unset or empty (design decisions 1, 2); verify `pnpm nx build api`, then `APP_VERSION=abc node apps/api/dist/main.js` answers `curl -s localhost:3000/health` with `{"status":"ok","version":"abc"}`, and `kill -TERM` on it exits within a second with status 0.
- [x] 1.4 Verify the boundary rule reaches the app: an import of `tools/change-scope` from `apps/api/src/main.ts` fails `pnpm nx lint api`; revert it.

## 2. `apps/api-e2e`

- [x] 2.1 Create `apps/api-e2e` as workspace package `api-e2e` tagged `type:app`, `scope:api` (ADR-0012 has no e2e tag; it imports no workspace library), with `implicitDependencies: ["api"]`, an `e2e` target that `dependsOn` `api:build` and runs plain Vitest over `src/**/*.spec.ts`, and no `test` target, keeping the derived `src/health.spec.ts` and `src/support/api-process.ts` (design decision 4); verify `pnpm nx e2e api-e2e` passes every derived test and `pnpm nx run-many -t test` does not run them.
- [x] 2.2 Verify the e2e target catches a regression: changing the controller's `status` to `"up"` fails `pnpm nx e2e api-e2e`, and `pnpm nx show projects --affected --base=HEAD` (with the edit uncommitted) lists `api-e2e`; revert it.

## 3. Image

- [ ] 3.1 Write `apps/api/Dockerfile` and the root `.dockerignore` as design decision 5 describes, with the base image at an exact Node 24 version; verify `docker build -f apps/api/Dockerfile --build-arg APP_VERSION=local -t basis-api:local .` succeeds, `docker run --rm basis-api:local id -u` is not `0`, and `docker image inspect` shows the `HEALTHCHECK`.
- [ ] 3.2 Verify the image runs as specified: `docker run -d -p 3000:3000 basis-api:local` becomes `(healthy)` in `docker ps`, `curl -s localhost:3000/health` answers `{"status":"ok","version":"local"}`, and `docker stop` completes without hitting its 10-second kill timeout.
- [ ] 3.3 Verify the build context: with a file `.env.probe` at the repository root and a working tree under `.worktrees/`, `docker build` with a `RUN ls -a` probe stage shows neither; remove the probe.
- [ ] 3.4 Add the `docker` ecosystem for `/apps/api` to `.github/dependabot.yml`, monthly, prefix `chore(deps)`; verify the file parses (`python3 -c 'import yaml,sys;yaml.safe_load(open(sys.argv[1]))' .github/dependabot.yml`).

## 4. Compose file

- [ ] 4.1 Write `deploy/api/docker-compose.yml` as design decision 6 describes; verify `IMAGE_TAG=local docker compose -f deploy/api/docker-compose.yml config` succeeds and lists no volume.
- [ ] 4.2 Verify the service runs under its restrictions: with a local `platform_edge` network (`docker network create platform_edge`) and `basis-api:local` tagged as `ghcr.io/shatynska-labs/basis-api:local`, `IMAGE_TAG=local docker compose -f deploy/api/docker-compose.yml up -d --wait` (with an empty `deploy/api/.env`) returns success; then remove the containers, the network and the `.env`.
- [ ] 4.3 Verify `--wait` fails on an unhealthy service: with the healthcheck's URL changed to a path answering `404`, the same `up -d --wait` exits non-zero; revert it.

## 5. Workflows

- [ ] 5.1 Add the `image` job to `ci.yml` (design decision 7); verify on this change's pull request that it runs and succeeds, and, on a throwaway commit breaking the `Dockerfile`, that it fails; drop that commit.
- [ ] 5.2 Write `.github/workflows/deploy.yml` (design decision 8), its `.env` rendering copied from `platform-deploy.yml`'s helper; verify `actionlint` reports nothing on it and on `ci.yml`, and that every `${{ secrets.* }}` it uses enters a step through `env:` or a `with:` input, never a `run:` body (`yq '.jobs[].steps[].run // ""' .github/workflows/deploy.yml | grep -n 'secrets\.'` prints nothing); that `github.sha` appears nowhere in it (`grep -n 'github\.sha' .github/workflows/deploy.yml` prints nothing); and that its `workflows:` entry equals `ci.yml`'s `name:` and `ci.yml`'s `on:` includes `push` to `main` (`yq '.name, .on.push.branches' .github/workflows/ci.yml`).
- [ ] 5.3 Verify the secret guard: run the guard step's script locally with one of the four variables empty; it exits non-zero naming that variable.
- [ ] 5.4 Verify the superseded-commit guard: run its script locally with `HEAD_SHA` set to a commit other than `git ls-remote origin refs/heads/main` reports and `RUN_ATTEMPT=1`; it ends with status 0, a notice naming the newer commit, and a step output that skips the delivery steps. With `RUN_ATTEMPT=2` it lets the deploy proceed; with `HEAD_SHA` equal to the tip it lets the deploy proceed.
- [ ] 5.5 Verify the post-deploy poll only warns: run its script locally against an unreachable URL and against a local stub answering `{"status":"ok","version":"other"}`; both exit 0 with a `::warning::` line, and against a stub answering the expected `version` it exits 0 with no warning.
- [ ] 5.6 Verify the rendering helper: run it locally on the values `a"b`, `c\d` and `e$f`, and read the output as `NAME="a\"b"`, `NAME="c\\d"` and `NAME="e$$f"`.

## 6. First deploy (needs the infrastructure-side change)

- [ ] 6.1 Operator: generate the deploy key `~/.ssh/shatynska-basis-api-main-production` (comment `basis-api-deploy-main-production`) and the probe key `~/.ssh/shatynska-basis-api-probe-main-production` (comment `basis-api-probe-main-production`; its private half stays at that path on the operator's workstation for the change that adds the database, design decision 9), and give both public halves and fingerprints to the infrastructure-side change; verify that change merged and its converge succeeded, and that `sudo ls /opt/basis-api` exists on the host.
- [ ] 6.2 Operator: create the `production` Environment on `Shatynska-Labs/basis` with `TAILSCALE_OAUTH_CLIENT_ID`, `TAILSCALE_OAUTH_SECRET`, `DEPLOY_HOST` and `BASIS_API_DEPLOY_SSH_KEY`, the key's fingerprint checked against the committed public half before storing, then delete the local private half; verify `gh secret list --repo Shatynska-Labs/basis --env production` lists all four.
- [ ] 6.3 Operator: create the DNS `A` record `api.basis.shatynska.com` pointing at the production host's public IPv4; verify `dig +short api.basis.shatynska.com` returns it.
- [ ] 6.4 After this change's pull request merges: verify CI on `main` succeeded and triggered a deploy run; if `docker compose pull` failed on access, the operator makes the `basis-api` package readable by the host (design, Risks) and re-runs it; verify the run is green.

## 7. Verification

- [ ] 7.1 Run `pnpm nx run-many -t lint typecheck test build e2e`, `pnpm format:check`, `pnpm audit --audit-level high` and `pnpm exec openspec validate --all --strict`; all pass.

## Workflow follow-up

- **confirm**: `curl -s https://api.basis.shatynska.com/health` answers `200` with a valid Let's Encrypt certificate and `version` equal to the merge commit's SHA; `docker ps` on the host shows `basis-api-api-1` `(healthy)`; the router `basis-api` appears on Grafana's "Application HTTP error rates" dashboard after the first requests. A second merge to `main` changes the reported `version` to its own SHA.
- archive, then remove the branch and working tree.
