## ADDED Requirements

### Requirement: The Google client IDs are rendered from the Environment

Each delivery SHALL take the Google client IDs from the variable `BASIS_API_GOOGLE_CLIENT_IDS` of the Environment it deploys in, pass them to the rendering only through a step's `env:`, and refuse before joining the tailnet when they are empty. Rendering SHALL refuse client IDs in which no entry remains once split on commas and trimmed. The rendered `.env` SHALL hold them unchanged as `GOOGLE_CLIENT_IDS`.

#### Scenario: Both workflows pass the Environment's variable

- **WHEN** `.github/workflows/deploy.yml` and `.github/workflows/promote.yml` are read
- **THEN** each passes `${{ vars.BASIS_API_GOOGLE_CLIENT_IDS }}` as the delivery's Google client IDs

#### Scenario: The client IDs reach the rendering through env

- **WHEN** `.github/actions/deliver-api/action.yml` is read
- **THEN** the client-ID input appears in no `run:` body as `${{ }}` text, reaches the rendering step through its `env:` as `GOOGLE_CLIENT_IDS`, and is among the inputs whose absence the first step refuses

#### Scenario: The client IDs are rendered

- **WHEN** `.env` is rendered with the client IDs `1-web.apps.googleusercontent.com,2-android.apps.googleusercontent.com`
- **THEN** it holds the line `GOOGLE_CLIENT_IDS="1-web.apps.googleusercontent.com,2-android.apps.googleusercontent.com"`

#### Scenario: No client IDs

- **WHEN** `.env` is rendered with the client IDs empty, `" "` or `" , "`
- **THEN** rendering fails naming `GOOGLE_CLIENT_IDS`, and no `.env` is written

### Requirement: The sign-up allowlist is rendered from the Environment's secret

Each delivery SHALL take the sign-up allowlist from the secret `BASIS_API_SIGNUP_ALLOWED_EMAILS` of the Environment it deploys in, and pass it to the rendering only through a step's `env:`. It MAY be empty. The rendered `.env` SHALL hold it unchanged as `SIGNUP_ALLOWED_EMAILS`, and it SHALL NOT be printed or written to the step's outputs.

#### Scenario: Both workflows pass the Environment's secret

- **WHEN** `.github/workflows/deploy.yml` and `.github/workflows/promote.yml` are read
- **THEN** each passes `${{ secrets.BASIS_API_SIGNUP_ALLOWED_EMAILS }}` as the delivery's sign-up allowlist

#### Scenario: The allowlist reaches the rendering through env

- **WHEN** `.github/actions/deliver-api/action.yml` is read
- **THEN** the allowlist input appears in no `run:` body as `${{ }}` text, reaches the rendering step through its `env:` as `SIGNUP_ALLOWED_EMAILS`, and is not among the inputs whose absence the first step refuses

#### Scenario: The allowlist is rendered

- **WHEN** `.env` is rendered with the allowlist `ann@example.org,bob@example.org`
- **THEN** it holds the line `SIGNUP_ALLOWED_EMAILS="ann@example.org,bob@example.org"`

#### Scenario: An empty allowlist

- **WHEN** `.env` is rendered with an empty allowlist
- **THEN** rendering succeeds and `.env` holds the line `SIGNUP_ALLOWED_EMAILS=""`

#### Scenario: The allowlist is not printed

- **WHEN** the rendering command succeeds with the allowlist `n0t-a-real@example.org`
- **THEN** neither its standard output, its standard error nor the outputs it writes contain `n0t-a-real@example.org`
