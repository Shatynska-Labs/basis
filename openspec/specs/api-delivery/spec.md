# api-delivery Specification

## Purpose

How a commit of the API reaches each host: a merge deploys staging, and production runs only what the operator promotes from what staging has run, as the same image by digest, at an address built from the server and the base domain, with every delivery judged by the health report naming the delivered commit.

## Requirements

### Requirement: A merge deploys staging and nothing else

A commit merged to `main` whose CI run on `main` succeeds SHALL have its image built once, pushed, and delivered to the staging host in the `staging` Environment. The workflow that runs on a merge SHALL declare no other Environment and SHALL read no setting naming the production host.

#### Scenario: The merge workflow targets staging only

- **WHEN** `.github/workflows/deploy.yml` is read
- **THEN** it is triggered only by `workflow_run` of `CI`, every job that declares an Environment declares `staging`, and the file does not mention `MAIN_PRODUCTION_DEPLOY_HOST` or the Environment `production`

### Requirement: Production is reached only by an operator's promotion of a named commit

The production host SHALL be delivered to only by `.github/workflows/promote.yml`, triggered by `workflow_dispatch` alone, with a required input naming the commit to promote. A promotion SHALL be refused, before anything is checked out, unless it runs from `refs/heads/main` and the input is a full 40-character lowercase hexadecimal commit SHA.

#### Scenario: The promotion has no automatic trigger

- **WHEN** the workflow files under `.github/workflows/` are read
- **THEN** `promote.yml` is triggered by `workflow_dispatch` only, with a required input `commit`, and it is the only workflow file declaring the Environment `production`

#### Scenario: A promotion from another branch is refused

- **WHEN** `promote.yml` is read
- **THEN** its job's first step refuses unless `github.ref` is `refs/heads/main`, and precedes every checkout

#### Scenario: A malformed commit is refused

- **WHEN** the staging gate is asked about `main`, a 7-character SHA, a 40-character SHA with an uppercase letter, or a 41-character string
- **THEN** it refuses, naming the input as not a full commit SHA, and makes no request

### Requirement: A promotion is refused unless staging ran that commit successfully

A promotion SHALL proceed only when GitHub's deployment records for the Environment `staging` and the promoted commit hold at least one deployment whose status history contains a `success` with no later `failure` or `error`. A deployment's later `inactive` status SHALL NOT withdraw its success, so that an earlier commit staging ran remains promotable as a rollback. Records whose commit or Environment differ from the ones asked about SHALL be ignored, whatever the query returned.

#### Scenario: No staging record

- **WHEN** the records hold no `staging` deployment of the commit
- **THEN** the promotion is refused, naming the commit and saying staging has not run it

#### Scenario: A successful staging deployment

- **WHEN** a `staging` deployment of the commit has the statuses `in_progress` then `success`
- **THEN** the promotion may proceed

#### Scenario: A success superseded by a later deployment

- **WHEN** a `staging` deployment of the commit has the statuses `success` then `inactive`
- **THEN** the promotion may proceed

#### Scenario: A success withdrawn by a later failure

- **WHEN** a `staging` deployment of the commit has the statuses `success` then `failure`, or `success` then `error`, and it is the commit's only `staging` deployment
- **THEN** the promotion is refused

#### Scenario: A deployment still in progress

- **WHEN** the commit's only `staging` deployment has the statuses `queued` then `in_progress`
- **THEN** the promotion is refused

#### Scenario: A record for another commit or Environment

- **WHEN** the response holds a successful deployment whose commit differs from the one asked about, or whose Environment is not `staging`, and no other
- **THEN** the promotion is refused

#### Scenario: GitHub does not answer

- **WHEN** the deployment records cannot be read
- **THEN** the promotion is refused, saying the records could not be read

### Requirement: Staging records success only for the commit it is running

A staging deploy SHALL deliver only a commit that is still `main`'s head, and SHALL NOT end successfully without delivering. Superseded before its deploy job, a commit SHALL be skipped there and leave no staging record; superseded while that job waits, or carried by a run whose own commit differs, it SHALL fail the job before delivering.

#### Scenario: Superseded before the deploy job

- **WHEN** the supersession verdict is asked for the skip stage with `main`'s head differing from the commit
- **THEN** the verdict is to skip, naming the newer head

#### Scenario: Superseded while waiting for the group

- **WHEN** the supersession verdict is asked for the deliver stage with `main`'s head differing from the commit
- **THEN** the verdict is to fail, naming the newer head

#### Scenario: The run's commit is not the delivered commit

- **WHEN** the supersession verdict is asked for the deliver stage with `main`'s head equal to the commit and the run's own commit differing from it
- **THEN** the verdict is to fail

#### Scenario: Still the head

- **WHEN** the supersession verdict is asked, at either stage, with `main`'s head, the commit and the run's own commit all equal
- **THEN** the verdict is to deliver

#### Scenario: The head cannot be read

- **WHEN** `main`'s head is empty or could not be read
- **THEN** the verdict is to fail, at either stage

### Requirement: Both hosts run the same image, by digest

The Compose file SHALL reference the image only as `ghcr.io/shatynska-labs/basis-api@<digest>`, the digest rendered into `.env`, for the service `api` and for the service `migrate` alike. Staging SHALL receive the digest its build produced, and a promotion the digest that the promoted commit's image tag resolves to, without building. A digest that is not `sha256:` followed by 64 lowercase hexadecimal characters SHALL be refused before `.env` is written.

#### Scenario: The rendered environment names a digest

- **WHEN** `.env` is rendered with the digest `sha256:` followed by 64 hexadecimal characters
- **THEN** it holds `IMAGE_DIGEST` with exactly that value

#### Scenario: A malformed digest is refused

- **WHEN** `.env` is rendered with an empty digest, a tag such as `latest`, or `sha256:` followed by fewer than 64 characters
- **THEN** rendering fails naming `IMAGE_DIGEST`, and no `.env` is written

#### Scenario: The Compose file has no tag

- **WHEN** `deploy/api/docker-compose.yml` is read
- **THEN** it has exactly two image references, the services `api` and `migrate`, and each is `ghcr.io/shatynska-labs/basis-api@${IMAGE_DIGEST…}`, failing when `IMAGE_DIGEST` is unset

### Requirement: What Compose resolves is checked before delivery

Before anything is delivered, the configuration Compose resolves from the Compose file and the rendered `.env` SHALL be refused unless the service `api`, and every other service it declares, resolves to the image `ghcr.io/shatynska-labs/basis-api@<rendered digest>`, and the service `api`'s Traefik router rule is exactly the rendered `ROUTER_RULE`. A refusal SHALL name the field at fault and SHALL NOT print any value from the configuration.

#### Scenario: The resolved configuration matches

- **WHEN** the resolved images of `api` and `migrate` equal the rendered digest reference and the resolved router rule equals the rendered rule
- **THEN** the check passes

#### Scenario: The resolved rule differs

- **WHEN** the resolved router rule differs from the rendered `ROUTER_RULE`, or is absent
- **THEN** the check fails naming the router rule, and its output contains neither rule

#### Scenario: The resolved image differs

- **WHEN** the resolved image of `api` is a tag, another repository, or another digest
- **THEN** the check fails naming the image

#### Scenario: The resolved migration image differs

- **WHEN** the configuration declares `migrate` and its resolved image is absent, a tag, another repository, or another digest, and `api`'s image and rule match
- **THEN** the check fails naming the service `migrate`'s image

### Requirement: The address is built from the server and the base domain

Each host's Traefik rule SHALL be rendered into `.env` as `ROUTER_RULE`, routing `basis-api.<server>.<base domain>` (server `main-staging` or `main-production`) and, on production only, the alias `api.basis.<base domain>`, in Traefik v3's `||` form. The base domain SHALL be `BASE_DOMAIN`, refused unless a hostname of two or more labels. No hostname SHALL be literal in the Compose or workflow files.

#### Scenario: Staging's rule

- **WHEN** `.env` is rendered for staging with the base domain `example.org`
- **THEN** `ROUTER_RULE` is ``Host(`basis-api.main-staging.example.org`)`` and the reported technical hostname is `basis-api.main-staging.example.org`

#### Scenario: Production's rule

- **WHEN** `.env` is rendered for production with the base domain `example.org`
- **THEN** `ROUTER_RULE` is ``Host(`basis-api.main-production.example.org`) || Host(`api.basis.example.org`)`` and the reported technical hostname is `basis-api.main-production.example.org`

#### Scenario: A missing or malformed base domain

- **WHEN** `.env` is rendered with the base domain empty, `localhost`, `Example.org` or `example..org`
- **THEN** rendering fails naming `BASE_DOMAIN`, and no `.env` is written

#### Scenario: An unknown target

- **WHEN** `.env` is rendered for a target other than `staging` or `production`
- **THEN** rendering fails naming the target

#### Scenario: No literal hostname

- **WHEN** `deploy/api/docker-compose.yml`, `.github/workflows/deploy.yml` and `.github/workflows/promote.yml` are read
- **THEN** none contains `shatynska.com`, `main-staging.` or `main-production.`, and the Compose file's router rule is `${ROUTER_RULE…}`, failing when unset

### Requirement: Rendered values reach Compose unchanged

Every value written into `.env` SHALL be double-quoted with `\` replaced by `\\`, then `"` by `\"`, then `$` by `$$`, the infrastructure repository's escaping rule, so that Compose reads back exactly the value rendered.

#### Scenario: Characters Compose would otherwise interpret

- **WHEN** a value containing `a"b`, `c\d`, `e$f` or a backtick is rendered
- **THEN** its line reads `NAME="a\"b"`, `NAME="c\\d"`, `NAME="e$$f"`, or the backtick unchanged inside the quotes

### Requirement: A delivery fails unless the public health report names the delivered commit

After delivering, each deploy and each promotion SHALL poll `https://<technical hostname>/health` until its `version` equals the delivered commit, and SHALL fail when that does not happen within the window, so that a staging record of success means staging was observed running that commit.

#### Scenario: The report names the commit

- **WHEN** the health report answers with `version` equal to the delivered commit within the window
- **THEN** the wait succeeds

#### Scenario: The report names another commit throughout

- **WHEN** the health report answers with a different `version` for the whole window
- **THEN** the wait fails, naming the version reported and the one expected

#### Scenario: The report never answers

- **WHEN** the health report does not answer, or answers with a non-`200` status, for the whole window
- **THEN** the wait fails, saying it did not answer

#### Scenario: A late answer

- **WHEN** the health report first answers with a different `version` and later, within the window, with the delivered commit
- **THEN** the wait succeeds

### Requirement: A Compose file without a migration service stays promotable

The check of what Compose resolves SHALL pass a configuration declaring no `migrate` service, as every commit before migrations were delivered has, so that such a commit stays promotable as a rollback.

#### Scenario: A Compose file from before migrations were delivered

- **WHEN** the resolved configuration declares only the service `api`, whose image and rule match
- **THEN** the check passes

### Requirement: Each delivery migrates the database before the API starts

The Compose file SHALL declare a service `migrate` that runs the migration process (`node dist/migrate.js`) once, from the `.env` the delivery rendered, on the network that reaches the shared PostgreSQL instance, without restarting. The service `api` SHALL start only after `migrate` has completed successfully, so that a failed migration fails the delivery's `docker compose up -d --wait`.

#### Scenario: The migration runs once before the API

- **WHEN** `deploy/api/docker-compose.yml` is read
- **THEN** the service `migrate` has the command `node dist/migrate.js`, the `env_file` `.env`, the network `platform_edge`, `restart` set to `"no"`, no Traefik label, and its health check disabled, and the service `api` depends on `migrate` with the condition `service_completed_successfully`

#### Scenario: The migration service is confined like the API

- **WHEN** `deploy/api/docker-compose.yml` is read
- **THEN** the service `migrate` is `read_only`, drops all capabilities, sets `no-new-privileges:true`, and declares no volume

### Requirement: The database URL is rendered from the target's database password

The rendered `.env` SHALL hold `DATABASE_URL` as `postgres://basis-api:<password>@postgres:5432/basis-api`, with the password percent-encoded as a URL component. Rendering SHALL be refused when the password is empty, naming `DATABASE_PASSWORD`, and no `.env` SHALL be written. Neither the password nor the URL SHALL be printed or written to the step's outputs.

#### Scenario: A password is rendered into the URL

- **WHEN** `.env` is rendered for either target with the database password `3f9a0c`
- **THEN** it holds `DATABASE_URL` with exactly the value `postgres://basis-api:3f9a0c@postgres:5432/basis-api`

#### Scenario: Characters a URL would otherwise interpret

- **WHEN** `.env` is rendered with the database password `a@b:c/d%e`
- **THEN** `DATABASE_URL`'s value is `postgres://basis-api:a%40b%3Ac%2Fd%25e@postgres:5432/basis-api`

#### Scenario: No password

- **WHEN** `.env` is rendered with an empty database password
- **THEN** rendering fails naming `DATABASE_PASSWORD`, and no `.env` is written

#### Scenario: The password is not printed

- **WHEN** the rendering command succeeds with the database password `n0t-a-real-pa55word`
- **THEN** neither its standard output, its standard error nor the outputs it writes contain `n0t-a-real-pa55word` or `DATABASE_URL`

### Requirement: The database password reaches a delivery from the Environment alone

Each delivery SHALL take the database password from the secret `BASIS_API_DATABASE_PASSWORD` of the Environment it deploys in, pass it to the rendering only through a step's `env:`, and refuse before joining the tailnet when it is empty.

#### Scenario: Both workflows pass the Environment's secret

- **WHEN** `.github/workflows/deploy.yml` and `.github/workflows/promote.yml` are read
- **THEN** each passes `${{ secrets.BASIS_API_DATABASE_PASSWORD }}` as the delivery's database password, and neither mentions the secret elsewhere

#### Scenario: The password reaches the rendering through env

- **WHEN** `.github/actions/deliver-api/action.yml` is read
- **THEN** the database password input appears in no `run:` body as `${{ }}` text, reaches the rendering step through its `env:` as `DATABASE_PASSWORD`, and is among the inputs whose absence the first step refuses
