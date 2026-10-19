## MODIFIED Requirements

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

Before anything is delivered, the configuration Compose resolves from the Compose file and the rendered `.env` SHALL be refused unless the service `api`, and every other service it declares, resolves to the image `ghcr.io/shatynska-labs/basis-api@<rendered digest>`, and the service `api`'s Traefik router rule is exactly the rendered `ROUTER_RULE`. A Compose file declaring no `migrate` service, as every commit before migrations were delivered does, SHALL pass, so that such a commit stays promotable as a rollback. A refusal SHALL name the field at fault and SHALL NOT print any value from the configuration.

#### Scenario: The resolved configuration matches

- **WHEN** the resolved images of `api` and `migrate` equal the rendered digest reference and the resolved router rule equals the rendered rule
- **THEN** the check passes

#### Scenario: A Compose file from before migrations were delivered

- **WHEN** the resolved configuration declares only the service `api`, whose image and rule match
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

## ADDED Requirements

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
