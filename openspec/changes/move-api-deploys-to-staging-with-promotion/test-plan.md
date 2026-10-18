# Test plan: move-api-deploys-to-staging-with-promotion

Derived from `specs/api-delivery/spec.md` at commit `42eed2d`, before implementation, by an author who has not read the implementation. This file is not an artifact the OpenSpec schema knows: it does not appear among `openspec instructions apply`'s context files and must be read on purpose.

All tests live in `tools/delivery/src/`. Select one file with `pnpm nx run delivery:test -- <file>` once the project shell exists, or one test with `pnpm nx run delivery:test -- <file> -t "<test name>"` (Vitest's `-t` matches the `describe` and `it` names joined by a space). Test identifiers below are `<file> > <describe> > <it>`.

## Prerequisites the tests need and this pass did not create

The test author's pass writes only inside the test-path glob and this manifest. tasks.md §0 and the dispatch also assign the test author the `tools/delivery` project shell and the `yaml` dependency; those are outside the glob and were **not written** (see the report). Until they exist:

- `pnpm nx run-many -t test -p delivery` runs 0 tasks: there is no `delivery` project.
- `delivery-files.spec.ts` cannot load: `yaml` is not resolvable from the workspace root (2.9.1 is in the store, not a root dependency).

Still to do, before or as task 1.1: `tools/delivery/{package.json (@basis/delivery), project config (Nx name delivery, tags scope:tooling, type:tooling; test inputs adding {workspaceRoot}/.github/workflows/**, {workspaceRoot}/.github/actions/**, {workspaceRoot}/deploy/api/**), tsconfig.json, tsconfig.lib.json, tsconfig.spec.json, vitest.config.mts, eslint.config.mjs}` copied from `tools/change-scope`, `pnpm add -D -w yaml@2.9.1`, and `pnpm nx sync`.

## Scenarios (32 in the delta spec, 32 accounted for)

### Requirement: A merge deploys staging and nothing else

1. **The merge workflow targets staging only**: `delivery-files.spec.ts > the merge workflow targets staging only > .github/workflows/deploy.yml is triggered by CI alone and declares only staging`. Specified: only `workflow_run`, of `CI` alone; every declared Environment is `staging`; the text does not contain `MAIN_PRODUCTION_DEPLOY_HOST`. Derived: at least one job declares an Environment (the requirement delivers "in the `staging` Environment"; without it the check is vacuous). "Does not mention the Environment `production`" is checked on the parsed job Environments, not on the word `production` in prose or comments (a derived reading).

### Requirement: Production is reached only by an operator's promotion of a named commit

2. **The promotion has no automatic trigger**: `delivery-files.spec.ts > the promotion has no automatic trigger > .github/workflows/promote.yml is triggered by workflow_dispatch alone, with a required commit` and `... > promote.yml is the only workflow declaring production`. Specified: trigger set is exactly `workflow_dispatch`; `inputs.commit.required === true`; no other `*.yml`/`*.yaml` under `.github/workflows/` declares `production`; `promote.yml` declares it.
3. **A promotion from another branch is refused**: `delivery-files.spec.ts > a promotion from another branch is refused > the promotion job's first step refuses unless github.ref is refs/heads/main, before every checkout` and `... > run before any checkout, it refuses another ref and admits main`. Specified: exactly one job ("its job"); its first step is a shell step naming `refs/heads/main` and reading `github.ref`/`GITHUB_REF`; no checkout is first. The second test executes the steps before the first checkout with bash (`--noprofile --norc -eo pipefail`, GitHub's default), substituting `${{ github.ref }}` and `${{ inputs.commit }}`: specified that `refs/heads/other` exits non-zero and `refs/heads/main` with a full SHA exits 0. Derived: the job checks something out at all; the refusal's output contains the ref (`refs/heads/other`), as task 4.2 says; the refusal is unconditional shell (a step with `if:` before the checkout, or any other `${{ }}` expression there, throws as unsupported — design decision 1 says "in shell").
4. **A malformed commit is refused**: `staging-gate.spec.ts > a malformed commit is refused > refuses %s, naming it as not a full commit SHA, with no request` (cases `main`, 7-char, 40-char with uppercase, 41-char). Specified: `{ ok: false }`, reason matches `/full commit sha/i`, `getJson` never called. Derived: `isCommitSha rejects %s` and `isCommitSha accepts a full lowercase SHA` (the function is design decision 7's). Also, from the requirement ("refused, before anything is checked out, unless ... the input is a full ... SHA"), specified by the requirement rather than this scenario: `delivery-files.spec.ts > a promotion from another branch is refused > run before any checkout, it refuses a malformed commit`.

### Requirement: A promotion is refused unless staging ran that commit successfully

The fake GitHub API (`fakeGitHub`) answers `/repos/<repo>/deployments` with every record it holds, whatever the query string, and `/deployments/<id>/statuses` with statuses newest first; any other URL rejects. Deployments carry `statuses_url` so either way of reaching statuses works.

5. **No staging record**: `staging-gate.spec.ts > the staging gate > no staging record: refuses, naming the commit and saying staging has not run it`. Specified: refused, reason contains the commit and matches `/staging/i`.
6. **A successful staging deployment**: `... > a successful staging deployment: may proceed`. Specified: `ok: true`. Derived: `deploymentId` is the deployment's id (design decision 7).
7. **A success superseded by a later deployment**: `... > a success superseded by a later deployment: may proceed`. Specified; `deploymentId` derived as above.
8. **A success withdrawn by a later failure**: `... > a success withdrawn by a later %s on the only deployment: refused` (`failure`, `error`). Specified.
9. **A deployment still in progress**: `... > a deployment still in progress: refused`. Specified.
10. **A record for another commit or Environment**: `... > a successful record for another commit, and no other: refused` and `... > a successful record for another Environment, and no other: refused`. Specified.
11. **GitHub does not answer**: `... > GitHub does not answer: refused, saying the records could not be read`. Specified: reason matches `/could not be read/i`.

Specified by the requirement text rather than a scenario: `... > one failed and one successful staging deployment of the commit: may proceed` ("at least one deployment"), `... > records for another commit and Environment beside a successful one: may proceed on the matching one` (deploymentId derived), and `hasSucceeded: statuses as GitHub serves them, newest first > %s` (the scenario histories, plus `no statuses` → false and `failure then success` → true, both from "a `success` with no later `failure` or `error`").

### Requirement: Staging records success only for the commit it is running

12. **Superseded before the deploy job**: `supersession.spec.ts > decide: superseded before the deploy job > skips at the skip stage, naming the newer head`. Specified: `action: 'skip'`, reason contains the head.
13. **Superseded while waiting for the group**: `supersession.spec.ts > decide: superseded while waiting for the group > fails at the deliver stage, naming the newer head`. Specified.
14. **The run's commit is not the delivered commit**: `supersession.spec.ts > decide: the run's commit is not the delivered commit > fails at the deliver stage`. Specified.
15. **Still the head**: `supersession.spec.ts > decide: still the head > delivers at the %s stage` (`skip`, `deliver`). Specified; the exact shape `{ action: 'deliver' }` is design decision 7's (derived).
16. **The head cannot be read**: `supersession.spec.ts > decide: the head cannot be read > an empty head fails at the %s stage` (specified) and `supersession.spec.ts > supersession command: the head could not be read > an unreachable remote fails at the %s stage` (specified that it fails; derived from design decision 7: exit status `1`, `::error::` on output, no `deliver=true` in `$GITHUB_OUTPUT`). The command test runs `git ls-remote` against a nonexistent local path; no network.

### Requirement: Both hosts run the same image, by digest

17. **The rendered environment names a digest**: `render-env.spec.ts > the rendered environment names a digest > holds IMAGE_DIGEST with exactly that value`. Specified: exactly one line `IMAGE_DIGEST="<digest>"` (quoting from "Rendered values reach Compose unchanged").
18. **A malformed digest is refused**: `render-env.spec.ts > a malformed digest is refused > renderEnv throws naming IMAGE_DIGEST for "%s"` and `... > the command writes no .env for "%s"` (empty, `latest`, `sha256:` + 63 chars). Specified: throws/output names `IMAGE_DIGEST`; non-zero exit; no `.env` exists afterwards.
19. **The Compose file has no tag**: `delivery-files.spec.ts > the Compose file has no tag > deploy/api/docker-compose.yml's only image reference is the digest, failing when unset`. Specified: exactly one service with an `image`, it is service `api` (the service the "What Compose resolves" requirement names), matching `ghcr.io/shatynska-labs/basis-api@${IMAGE_DIGEST:?<message>}`. "Failing when unset" is read as Compose's `:?` form (derived reading).

Specified by the requirement ("a promotion ... without building"), not a scenario: `delivery-files.spec.ts > a promotion does not build > .github/workflows/promote.yml uses no build action` (no `docker/build-push-action` step, no `docker build`/`docker buildx build` in the text).

### Requirement: What Compose resolves is checked before delivery

20. **The resolved configuration matches**: `check-compose.spec.ts > the resolved configuration matches > passes`. Specified (`{ ok: true }` exact shape from design decision 7, derived).
21. **The resolved rule differs**: `check-compose.spec.ts > the resolved rule differs > fails naming the router rule when the rule %s, printing neither rule` (differs, absent) and `check-compose.spec.ts > the check-compose command > exits 1 on a differing rule, its output containing neither rule`. Specified: `ok: false`; reason/output matches `/rule/i`; neither hostname appears. Derived: exit status `1`.
22. **The resolved image differs**: `check-compose.spec.ts > the resolved image differs > fails naming the image when it is %s` (tag, another repository, another digest). Specified: `ok: false`, reason matches `/image/i`; reason does not contain the resolved image (from "SHALL NOT print any value from the configuration").

Derived: `check-compose.spec.ts > the check-compose command > exits 0 when the resolved configuration matches` (design decision 7's command contract; also what makes the exit-1 test discriminate).

### Requirement: The address is built from the server and the base domain

23. **Staging's rule**: `render-env.spec.ts > staging's rule > routes the staging technical hostname only`. Specified.
24. **Production's rule**: `render-env.spec.ts > production's rule > routes the production technical hostname and the alias`. Specified.
25. **A missing or malformed base domain**: `render-env.spec.ts > a missing or malformed base domain > renderEnv throws naming BASE_DOMAIN for "%s"` and `... > the command writes no .env for "%s"` (empty, `localhost`, `Example.org`, `example..org`). Specified.
26. **An unknown target**: `render-env.spec.ts > an unknown target > renderEnv throws naming the target`. Specified; "naming the target" is matched as `/target|preview/i` — either the word or the value given (see unresolved questions).
27. **No literal hostname**: `delivery-files.spec.ts > no literal hostname > %s contains no literal hostname` (Compose, deploy.yml, promote.yml) and `... > deploy/api/docker-compose.yml's router rule is ${ROUTER_RULE…}, failing when unset`. Specified; the rule label is read from list or map form; `:?` reading as above. Derived (the action is not named by the scenario): `... > .github/actions/deliver-api/action.yml contains no literal hostname`.

### Requirement: Rendered values reach Compose unchanged

28. **Characters Compose would otherwise interpret**: `render-env.spec.ts > characters Compose would otherwise interpret > renders %s as %s` (`a"b`, `c\d`, `e$f`, a backtick). Specified. Also specified by the requirement's stated order: `\"$` → `NAME="\\\"$$"`.

Derived (design decision 7 and task 1.3): `render-env.spec.ts > the command, on success > writes the rendered .env with mode 0600 and reports the hostname and rule` — file content equals `renderEnv(...).content` and ends with a newline, mode `0600`, `$GITHUB_OUTPUT` holds `technical-hostname=` and `router-rule=` lines. It is also what makes the "no `.env` is written" tests discriminate: a command that never writes would otherwise pass them.

### Requirement: A delivery fails unless the public health report names the delivered commit

29. **The report names the commit**: `await-version.spec.ts > the report names the commit > succeeds`. Specified (`{ ok: true }`). Derived: the first request is to `url`.
30. **The report names another commit throughout**: `await-version.spec.ts > the report names another commit throughout > fails naming the version reported and the one expected`. Specified: `ok: false`, reason contains both. Derived (design decision 6/7): `fetch` called `attempts` times, `sleep` called `attempts - 1` times, each with `intervalMs` (no sleep after the last attempt).
31. **The report never answers**: `await-version.spec.ts > the report never answers > fails saying it did not answer when it %s` (rejected fetch, 503, 404). Specified: reason matches `/did not answer/i`. Derived: `attempts` calls.
32. **A late answer**: `await-version.spec.ts > a late answer > succeeds once the commit is reported within the window`. Specified. Derived: polling stops at the matching answer (2 calls).

No scenario is uncovered.

## Fixture-driven discriminators (static checks)

The checks in `delivery-files.spec.ts` are functions applied both to the repository's files and to inline fixtures under `delivery-files.spec.ts > the checks themselves discriminate > ...`: a passing fixture for each check, and failing fixtures for each property (push trigger, another workflow, a production job, no Environment, the production host variable; push trigger and optional commit on the promotion; checkout first; a first step ignoring the ref; another workflow declaring production; a refusal that refuses nothing; a tag, a `:-` default, a second image; a literal rule, a rule without `:?`; each literal hostname). These are derived: each exists to show its check can fail.

**Not executed in this pass.** `delivery-files.spec.ts` cannot load until `yaml` is a root dependency, so neither the discriminators nor the file checks ran. The promotion fixture's refusal script, its YAML parse, the permissive-fixture rewrite and the Compose fixture's parse were exercised by hand against `yaml@2.9.1` from the store (status 0 for main + full SHA, 1 for another ref, 1 for `main` as commit). The first run after the shell and dependency land must show every `the checks themselves discriminate` test passing; any failure there is a defect in the test (state 3), not in the workflows.

**Red at authoring, on real content.** Every file check is red now: `promote.yml` and `action.yml` do not exist (absent target); `deploy.yml` and `docker-compose.yml` were not read by this author and are expected to lack the properties (deploy declares `production` and reads the production host; Compose references a tag and a literal rule, per design decisions 1–3). The transition to green as tasks 2.1, 3.1, 4.1 and 4.2 land is what establishes they discriminate on real content.

## Obsolete tests

Not applicable: the change carries only `ADDED` deltas, so no existing behaviour's requirement is superseded. (The existing `deploy.yml` behaviour being replaced belongs to `deploy-api-skeleton`'s design, not to a spec this change modifies; no test under the glob was found bearing on it — the glob holds only `tools/change-scope/src/docs-only.spec.ts`, `libs/shared/core/src/lib/result.spec.ts` and the excluded `apps/api-e2e/src/health.spec.ts`.)

## Unresolved project questions

1. **Project shell and `yaml` dependency.** tasks.md §0 assigns them to the test author; this pass writes only inside the test-path glob, so they are outstanding. Every test in this plan depends on the shell to run through Nx; `delivery-files.spec.ts` depends on `yaml`.
2. **No stack skill.** The library carries no TypeScript/Vitest skill; tests follow `tools/change-scope/src/docs-only.spec.ts`'s idiom (`.ts` imports, `spawnSync(process.execPath, [script])`). All tests depend on that assumption.
3. **"Naming the target"** (scenario 26) is matched as the word `target` or the value given, case-insensitive. Test: `render-env.spec.ts > an unknown target > ...`.
4. **Message wording.** Scenario phrases are matched case-insensitively as substrings: `full commit sha`, `staging`, `could not be read`, `did not answer`, `rule`, `image`, `IMAGE_DIGEST`, `BASE_DOMAIN`. An implementation must use those words.
5. **Command tests need `git` and `bash` on `PATH`** (supersession command test; promotion refusal execution). Assumed present on developer machines and GitHub runners.

## Baseline

Full suite, before any test was written: `pnpm nx run-many -t test --skip-nx-cache` — 3 projects, all passed (two Vitest projects: 18 and 30 tests). `pnpm nx run-many -t test -p delivery`: 0 tasks (no such project).

After writing, run directly with `pnpm exec vitest run --root tools/delivery` (no config): all 6 files fail to load — five on the absent scripts (`Cannot find module './<script>.ts'`), `delivery-files.spec.ts` on the absent `yaml` package. State 2 (target absent) throughout: no assertion has executed yet.
