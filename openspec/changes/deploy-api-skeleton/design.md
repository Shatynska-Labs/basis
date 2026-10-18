## Context

The workspace (`scaffold-workspace`) holds `libs/shared/core` and `tools/change-scope`, a CI gate and hooks, and no application. `eslint.config.mjs` already carries the `type:app` + `scope:api` boundary row, so `apps/api` is constrained from its first commit.

The production host is operated from `Shatynska-Labs/infrastructure`, which fixes the contract an application meets (`docs/onboard-an-application.md`, `platform/README.md`):

- an application named `<app>` publishes to exactly `ghcr.io/<owner>/<app>:<tag>`, or the host's image reclamation silently reclaims nothing;
- its deploy key, authorised by a `deploy_apps` entry in the host's own vars file, has a forced command that extracts exactly `docker-compose.yml` and `.env` from a tarball on standard input into `/opt/<app>` and runs `docker compose pull && docker compose up -d --wait`, so the deploy fails if a service does not become healthy;
- the deploy job reaches the host over Tailscale, with `TAILSCALE_OAUTH_CLIENT_ID`, `TAILSCALE_OAUTH_SECRET`, `DEPLOY_HOST` and the deploy key held in the application repository's own GitHub Environment;
- the service joins the external `platform_edge` network; Traefik's `websecure` entrypoint applies TLS through Let's Encrypt (TLS-ALPN-01) by default, and `web` redirects to it, so a router needs only `traefik.enable` and a `Host` rule;
- `.env` is rendered with every value escaped (`\` → `\\`, `"` → `\"`, `$` → `$$`, in that order) by one helper, as `platform-deploy.yml`'s _Render .env from secrets_ step does, with secrets entering the step through `env:` rather than `${{ }}` in a `run:` body;
- anything the Compose file persists states why it needs no backup.

Staging is switched off; production is the only target. The application name is `basis-api`, the hostname `api.basis.shatynska.com`, outside the server wildcard, so it takes a DNS `A` record of its own.

## Goals / Non-Goals

**Goals:**

- A merge to `main` that passes CI on `main` reaches production with no step on a workstation, and a deploy that comes up unhealthy fails the run.
- What runs in production can be read from production: `GET /health` names the commit its image was built from.
- Every later API change inherits the image, the Compose file and the workflow unchanged, adding only its own settings and secrets.

**Non-Goals:**

- A staging target, preview environments, or a manual dispatch path. Staging is off; when it returns it is a second `deploy` job on a `staging` Environment, which `docs/onboard-an-application.md` §4.4 describes.
- Rollback tooling. Re-running the deploy of an earlier `main` commit, or reverting and merging, is the rollback (Migration Plan).
- A readiness check that probes dependencies. There are none; when the first one arrives, its change decides whether `/health` stays liveness-only and a readiness endpoint joins it.
- Branch protection and required checks: repository settings, set by the operator.

## Decisions

### 1. `/health` lives in `apps/api`, not in a context library

Liveness is a property of the deployable, not of any bounded context (`docs/architecture/context-map.md`): no context owns it and no other app needs it. The app is the composition root, and ADR-0012 §7 lets it depend on any server library, so the health controller sits in `apps/api/src/health/` beside `main.ts` and the root module. A `libs/platform/health` library was considered and rejected: a new scope with one consumer, and a tag row ADR-0012 does not have.

`@nestjs/terminus` was considered and rejected: its value is aggregating dependency indicators, and the specification forbids the check from depending on anything. A plain controller returning `{ status: 'ok', version }` is the whole requirement.

### 2. The build identifier is baked into the image

The image is built with a build argument `APP_VERSION` set to the commit SHA and exposes it as the `APP_VERSION` environment variable; the API reads it once at start and reports `"unknown"` when it is unset or empty. Baking it in, rather than rendering it into `.env`, makes the reported version a property of the image that is actually running — a container started from a stale image cannot claim the new SHA because `.env` changed. The same variable unset in tests and local runs gives the specification's `"unknown"` case.

### 3. NestJS 12 on Express, compiled by SWC everywhere

`@nestjs/platform-express`: Nest's default, with nothing here needing Fastify's throughput. Nest's dependency injection needs decorator metadata, which esbuild does not emit (ADR-0012 Consequences), so SWC compiles the API in all three places: the `build` target uses `@nx/js:swc` with an `apps/api/.swcrc` enabling `legacyDecorator` and `decoratorMetadata` and setting `externalHelpers: false`, so the executor needs `@swc/cli` beside `@swc/core` and the output needs no runtime `@swc/helpers`; Vitest uses `unplugin-swc` for `apps/api`; the `typecheck` target stays `tsc --noEmit` from the inferred plugin. `apps/api/tsconfig*.json` set `experimentalDecorators` and `emitDecoratorMetadata`; no other project does. Webpack (the `@nx/nest` default) was considered and rejected: a second bundler, and nothing to bundle while the API has no workspace dependency that cannot be resolved through `node_modules`.

The process listens on `PORT`, defaulting to `3000`, calls `enableShutdownHooks()` so `SIGTERM` from `docker stop` closes the server cleanly, and logs through Nest's default logger to standard output, where the host's daemon bounds it.

### 4. `apps/api-e2e` starts the built API as a process

The end-to-end project starts the built API (`node apps/api/dist/main.js`) as a child process per scenario group, with `PORT` set to a free port and `APP_VERSION` set, empty or absent as the scenario needs, waits until `/health` answers, drives it with supertest against that base URL, and stops it with `SIGTERM`. The specification speaks of the build identifier the process "was started with", and this tests exactly that, through the same entry point the image runs. Booting the root module in-process through `@nestjs/testing` was considered and rejected: it imports code from `apps/api`, which `@nx/enforce-module-boundaries` forbids from another project, and it would bypass `main.ts`, where the port and shutdown hooks live. The e2e project imports nothing from the API, so it needs no decorators and no SWC: plain Vitest.

`AGENTS.md` names Testcontainers for this project; with no database or queue there is nothing to contain, so none is started, and the first change with a dependency adds it. The `e2e` target is the one `ci.yml` already names, so `nx affected` runs it once the project exists; it `dependsOn` `api:build`, and `apps/api-e2e` declares `implicitDependencies: ["api"]` so a change to the API affects it.

The specification's "nothing outside the process" scenario is shown by the run itself: the e2e process environment provides no database, queue, cache or object store, and a test asserts that the API starts and answers.

### 5. A multi-stage image built from the repository root

`apps/api/Dockerfile`, built with the repository root as context so the lockfile and workspace manifest are present:

- **build stage** — `node:24-<debian>-slim` at an exact version, `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm nx build api`, then `pnpm deploy --filter api --prod` into a self-contained directory holding `dist` and production `node_modules` only;
- **runtime stage** — the same base image, that directory copied in, `USER node`, `ENV NODE_ENV=production`, `ARG`/`ENV APP_VERSION`, `EXPOSE 3000`, `CMD ["node", "dist/main.js"]`, and a `HEALTHCHECK` that runs `node -e` with the built-in `fetch` against `http://127.0.0.1:3000/health` (the image's port; `PORT` exists for local runs and tests, and the image does not set it) and exits non-zero unless the status is `200` — the slim image has no `curl`, and adding one for this is a package to patch for nothing. Its timings are the platform stack's own: `--interval=15s --timeout=5s --retries=3 --start-period=10s`, so a healthy container reports healthy within seconds of starting and `--wait` does not sit through Docker's 30-second default.

A root `.dockerignore` excludes `node_modules`, `dist`, `.git`, `.worktrees`, `.claude`, `.nx` and `**/.env*`, so neither sibling working trees nor a local secret enter the build context. `pnpm deploy` of a workspace project needs `injectWorkspacePackages: true` in `pnpm-workspace.yaml` under pnpm 10 and later; that is set if, and only if, the apply finds `pnpm deploy` refusing without it.

Dependabot gains a `docker` ecosystem entry for `/apps/api`, monthly, so the base image is moved like everything else.

### 6. `deploy/api/docker-compose.yml` is what the host runs

```yaml
services:
  api:
    image: ghcr.io/shatynska-labs/basis-api:${IMAGE_TAG}
    restart: unless-stopped
    init: true
    env_file: .env
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    mem_limit: 512m
    healthcheck: # the image's own check, restated so --wait does not depend on reading the image
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1))"
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks: [platform_edge]
    labels:
      - traefik.enable=true
      - traefik.http.routers.basis-api.rule=Host(`api.basis.shatynska.com`)
      - traefik.http.services.basis-api.loadbalancer.server.port=3000
networks:
  platform_edge:
    external: true
```

It lives outside `apps/api` because it describes the host's runtime rather than the application, and the deploy tars it from `deploy/api` with `-C` so the host receives a bare `docker-compose.yml`. It persists nothing — no volume, no writable bind mount — so _No Store on This Host Holds Data Requiring Backup_ has nothing to classify; `read_only: true` makes that a property of the container rather than a promise. The router and service carry the application's name, because Traefik names are global across every Compose project on the host. The `mem_limit` is a ceiling for a process that idles near 60 MB, chosen so a leak is killed and alerted on (the platform's crash-loop/OOM alert) rather than starving the shared instance; the infrastructure repository has not yet sized limits (`size-platform-container-resource-limits` in its backlog), and this one is revisited when it does.

### 7. CI builds the image on every pull request, without pushing

`ci.yml` gains an `image` job: `docker/setup-buildx-action` and `docker/build-push-action` with `push: false`, the GitHub Actions cache, and `APP_VERSION` set to the head SHA. It runs whatever the documentation-only verdict, because the verdict is a step output of `check` and wiring it across jobs buys a minute on documentation pull requests at the cost of one more thing that can mis-judge. A `Dockerfile` that does not build therefore fails before merge, not on `main`.

### 8. The deploy runs after CI succeeds on `main`, never in parallel with it

`.github/workflows/deploy.yml` triggers on `workflow_run` of the `CI` workflow, `completed`, and its jobs run only when the triggering run's `conclusion` is `success`, its `event` is `push` and its `head_branch` is `main`. A merge commit can differ from what its pull request's CI saw, so deploying on `push` in parallel with CI could ship a commit `main`'s own CI then fails. `workflow_run` always runs the workflow definition on the default branch, so a pull request cannot alter what deploys; every checkout uses `github.event.workflow_run.head_sha`, never the default branch's current head, so the image is built from the commit CI judged. The infrastructure contract's example renders `IMAGE_TAG=${{ github.sha }}`; under `workflow_run` that is the default branch's tip at the time the run starts, not the commit built, so `github.sha` appears nowhere in this workflow: the checkout ref, the pushed tag, the `APP_VERSION` build argument and the rendered `IMAGE_TAG` all take `github.event.workflow_run.head_sha`. The trigger depends on `ci.yml`'s `name:` being exactly `CI` and on its `on:` including `push` to `main`; both are checked before merge (tasks).

- **`build-and-push`** — `permissions: contents: read, packages: write`; `docker/login-action` to `ghcr.io` with `GITHUB_TOKEN`; `docker/build-push-action` tagging `ghcr.io/shatynska-labs/basis-api:<head_sha>` only. No `latest` tag: the host's reclamation keeps what Compose references, and a floating tag would be a second name for an image it already keeps.
- **`deploy`** — `needs: supersession` (which `needs: build-and-push`), `if: needs.supersession.outputs.deliver == 'true'`, `environment: production`, `permissions: contents: read`, `concurrency: deploy-production` with `cancel-in-progress: false`, so no two deploys overlap. It runs only where the **`supersession`** job between the two (below) found the commit still `main`'s head. Steps, in the form `platform-deploy.yml` establishes: **first, the superseded-commit guard again** (below); then refuse unless `DEPLOY_HOST`, `BASIS_API_DEPLOY_SSH_KEY`, `TAILSCALE_OAUTH_CLIENT_ID` and `TAILSCALE_OAUTH_SECRET` are all non-empty, before joining anything; `tailscale/github-action` with `tags: tag:ci` and `ping` to the host; render `deploy/api/.env` through the escaping helper with `umask 077` (today it holds `IMAGE_TAG` alone, and later changes add their values through the same helper); write the key, `ssh-keyscan` the host; `tar -czf - -C deploy/api docker-compose.yml .env | ssh -i <key> deploy@$DEPLOY_HOST`; last, as `portfolio`'s deploy does, and gated on the same guard output as the delivery steps so a superseded run does not report on a deploy it never made, poll `https://api.basis.shatynska.com/health` for under two minutes (eight attempts of at most five seconds, ten seconds apart) and report, as a warning rather than a failure, when it does not answer or its `version` differs from `head_sha` — before DNS and the certificate exist it cannot answer, and the host-side `--wait` has already judged health.

**The superseded-commit guard.** The concurrency group admits deploys in the order they arrive, and they arrive in the order their CI runs finish, which is not commit order: `nx affected` and the documentation-only stand-down make CI's duration depend on the commit. Without a guard, an older commit whose CI was slower deploys after a newer one, and production runs a superseded commit with every run green. So the guard reads `refs/heads/main` with `git ls-remote`; if that is no longer `head_sha`, it ends successfully with a notice naming the newer commit, and nothing is delivered. It runs twice, from one step definition (a YAML anchor). First in a `supersession` job of its own, after `build-and-push` and before the deploy job asks for the concurrency group: GitHub keeps at most one pending job per group, and a newly queued job cancels the pending one, so a superseded commit that queued would cancel the newer commit's pending deploy and then skip itself, leaving `main`'s head undeployed with only a cancelled run to show for it. Skipped there, it never queues. Then again as the deploy job's first step, once it holds the group, for a newer commit that delivered while this one waited. What remains is a commit that passes the first check and is overtaken in the seconds before its deploy job queues, by a newer commit whose merge, CI and image build would all have to fit in those seconds. A re-run (`github.run_attempt > 1`) is exempt, so re-running an older run remains the rollback (Migration Plan). The trade-off is accepted: when the newer commit's CI fails, the skipped one stays undeployed until the next green merge — `main`'s head is broken then, and production keeps what it had.

Every merge to `main` that is still its head when its deploy runs deploys, documentation-only ones included, rebuilding an identical application under a new tag. That is accepted: skipping needs the affected graph in the deploy workflow, and a redeploy of an unchanged image is harmless and keeps "what runs is the head of `main`" true.

### 9. The infrastructure side is a change in that repository

The `deploy_apps` entry is the infrastructure repository's own content, under its own workflow and review, so it is opened there rather than written from here (proposal, Dependencies). The deploy key is generated by the operator, per its `docs/onboard-an-application.md` §2.1, on the host axis: `basis-api-deploy-main-production`. A probe key, `basis-api-probe-main-production`, is declared beside it although the application has no database, as `portfolio`'s and `shatynskyj`'s are in `host_vars/main-production.yml`: Basis takes a database in the shared instance later (`docs/backlog.md` `choose-durable-data-storage`), and declaring it now spares that change a second converge. Until then it can only answer `absent` (or `window-open`/`unreachable`), and this change's workflow does not call it, so its private half is not stored in the Environment (`docs/onboard-an-application.md` §4.2 omits the row for an application with no database). The private half stays at `~/.ssh/shatynska-basis-api-probe-main-production` on the operator's workstation until the database change stores it; if it is lost before then, that change regenerates the pair and re-converges — the same cost as declaring nothing now.

## Risks / Trade-offs

- [The host cannot pull the image: GHCR packages pushed from an organisation repository may be private by default] → The operator makes the `basis-api` package public, matching `Shatynska-Labs/basis`, which is public, or grants the host's GHCR user read access (`docs/onboard-an-application.md` §2.3); the first deploy's `docker compose pull` fails loudly if neither is done.
- [The certificate cannot issue until DNS resolves to the host] → The `A` record is created before the first deploy; until it propagates, the service is reachable from the tailnet with `curl -k --resolve` (`docs/onboard-an-application.md` §6).
- [A deploy whose `workflow_run` trigger is misconfigured never runs, and nothing fails] → Tasks provoke it: a merge to `main` must produce a deploy run, observed rather than assumed.
- [An `.env` value altered by the parser deploys a healthy container with the wrong setting] → The escaping helper is copied from `platform-deploy.yml`; today the only value is a hexadecimal SHA, so the risk arrives with the first secret, through the same helper.
- [The `production` Environment has no required reviewer, so every merge deploys unattended] → That is the intended trigger (`AGENTS.md`: a deploy triggered by merging). The operator may add a reviewer; the workflow does not depend on either.
- [Every merge rebuilds and redeploys] → Accepted (decision 8).
- [Deploys arrive out of commit order] → The superseded-commit guard (decision 8); a task provokes it.

## Migration Plan

1. Infrastructure: the `basis-api` entry in `deploy_apps` merged and converged on `main-production`.
2. Operator: the deploy keypair; the `production` Environment on `Shatynska-Labs/basis` with its four secrets; the DNS `A` record for `api.basis.shatynska.com` pointing at the production host.
3. This change's pull request merges; CI on `main` succeeds; the deploy builds, pushes and delivers.
4. Once the package exists, the operator makes it readable by the host if the first pull failed on access, and re-runs the deploy.

**Rollback:** re-run the `deploy` workflow run of an earlier `main` commit, which redeploys that commit's image tag and is exempt from the superseded-commit guard; GitHub allows a re-run only within 30 days of the original run, so beyond that the rollback is revert and merge. Removing the application entirely is `docker compose down` in `/opt/basis-api` by the operator and the `deploy_apps` entry's removal in the infrastructure repository.

## Open Questions

- Whether the `production` Environment gets a required reviewer. It changes no file here.
