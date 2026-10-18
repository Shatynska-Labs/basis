## Why

Nothing Basis builds can reach a device or a user yet: there is no application, no image and no path to the production host. Roadmap Phase 1 ends with "device data reaches the server", Phase 0 needs a public endpoint for the Health Connect bridge, and `AGENTS.md` assumes a deploy triggered by merging to the trunk. Building that path now, around an API that does nothing but answer that it is alive, means every later change — `identity`, `metrics`, the Phase 0 endpoint — ships through a pipeline already proven, and the first thing that can break in production is the pipeline rather than a feature.

## What Changes

- **`apps/api`** (`type:app`, `scope:api`): a NestJS 12 application on Express, compiled through SWC, that listens on a configurable port and serves one endpoint, `GET /health`, reporting that it is alive and which build it is. It depends on no database, queue or external service, and shuts down cleanly on `SIGTERM`.
- **`apps/api-e2e`**: the API end-to-end project `AGENTS.md` names, with supertest against the booted application, and its `e2e` target. No Testcontainers yet: the API has nothing to connect to.
- **Container image**: a multi-stage `Dockerfile` for `apps/api`, running as a non-root user with a Docker `HEALTHCHECK` against `/health`, published as `ghcr.io/shatynska-labs/basis-api:<commit sha>`.
- **`deploy/api/docker-compose.yml`**: the service definition the host runs, joining the external `platform_edge` network with Traefik labels routing `api.basis.shatynska.com`, a Compose healthcheck, `env_file: .env` and no persisted store.
- **CI**: the pull-request workflow also builds the image, without pushing it, so a broken `Dockerfile` fails before merge.
- **Deploy workflow** (`.github/workflows/deploy.yml`): once CI has succeeded on a push to `main`, build and push the image from the commit CI judged, then, in the `production` GitHub Environment, join the tailnet, render `.env` with the infrastructure repository's escaping rule, and deliver `docker-compose.yml` and `.env` to the host's forced-command deploy, which pulls the image and waits for the service to become healthy.
- **Operator steps** outside this repository, listed in tasks: the deploy keypair and the probe keypair, the `production` Environment and its secrets, read access to the image package for the host, and the DNS `A` record for `api.basis.shatynska.com`.

Not in this change: a database, Redis or Object Storage (`docs/backlog.md` `choose-durable-data-storage`), any bounded context, authentication, a staging target (staging is off), the web and mobile apps.

## Dependencies

- **Infrastructure-side onboarding** (`Shatynska-Labs/infrastructure`): a `basis-api` entry in `deploy_apps` of `ansible/inventory/host_vars/main-production.yml`, merged and converged, per that repository's `docs/onboard-an-application.md` §2. The first deploy cannot authenticate until it lands; that change is opened in the infrastructure repository and carried there under its own workflow. Everything here up to the first deploy proceeds without it.

## Capabilities

### New Capabilities

- `api-health`: the API's liveness report — what `GET /health` answers and that it depends on nothing beyond the process itself.

### Modified Capabilities

None. The image, the Compose file and the two workflows are tooling: their requirements are recorded in `design.md` and proved by tasks that provoke each one to fail, as `scaffold-workspace` did for the gate.

## Impact

- New projects: `apps/api`, `apps/api-e2e`.
- New files: `apps/api/Dockerfile`, `.dockerignore`, `deploy/api/docker-compose.yml`, `.github/workflows/deploy.yml`; `ci.yml` gains an image-build job.
- New dependencies: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`; development: `supertest`, `@types/supertest`, `unplugin-swc`, `@swc/core`, `@swc/cli`. `@swc/core` needs `allowBuilds` in `pnpm-workspace.yaml`.
- `apps/api`'s `tsconfig` enables `experimentalDecorators` and `emitDecoratorMetadata`, as `AGENTS.md` allows for projects compiling Nest code.
- GitHub: a `production` Environment on `Shatynska-Labs/basis` with the deploy secrets; a GHCR package `basis-api`.
- The production host runs one more container, reachable at `https://api.basis.shatynska.com`.
