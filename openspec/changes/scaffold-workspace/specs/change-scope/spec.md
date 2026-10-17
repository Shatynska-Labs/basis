## Purpose

Decides whether a set of changed paths is documentation-only, so that the commit hook, the push hook and continuous integration can skip project checks for a change that cannot affect them — one rule, shared by every caller, that runs the full checks whenever it cannot be sure.

## ADDED Requirements

### Requirement: A change is documentation-only only when every path is documentation

The classifier SHALL judge a list of repository-relative paths as `docs-only` when the list is non-empty and every path is documentation, and as `full` otherwise. A path SHALL be documentation when it ends in `.md`, in any directory, or ends in `.yaml` and lies under `openspec/`. Suffixes SHALL be matched case-sensitively. A path that is absolute, starts with `./`, or contains an empty or `..` segment SHALL NOT be documentation. Paths are taken as given: the classifier does not read the files, and a deleted path or either side of a rename is judged like any other.

#### Scenario: Markdown only

- **WHEN** the paths are `docs/backlog.md`, `AGENTS.md` and `libs/shared/core/README.md`
- **THEN** the verdict is `docs-only`

#### Scenario: A change record

- **WHEN** the paths are `openspec/changes/archive/2026-10-17-x/proposal.md` and `openspec/changes/archive/2026-10-17-x/.openspec.yaml`
- **THEN** the verdict is `docs-only`

#### Scenario: Markdown beside code

- **WHEN** the paths are `docs/backlog.md` and `libs/shared/core/src/index.ts`
- **THEN** the verdict is `full`

#### Scenario: YAML outside the change records

- **WHEN** the paths are `docs/a.md` and `.github/workflows/ci.yml`
- **THEN** the verdict is `full`

#### Scenario: A suffix in another case

- **WHEN** the paths are `docs/NOTES.MD`
- **THEN** the verdict is `full`

#### Scenario: A path that is not repository-relative

- **WHEN** the paths are `openspec/../x.yaml`, or `/abs/docs/a.md`, or `./docs/a.md`
- **THEN** the verdict is `full`

#### Scenario: A deleted or renamed source file

- **WHEN** the paths are `docs/a.md` and `libs/shared/core/src/lib/result.ts`, the latter being deleted or the source side of a rename
- **THEN** the verdict is `full`

#### Scenario: Nothing changed

- **WHEN** the list of paths is empty
- **THEN** the verdict is `full`

### Requirement: Declared exceptions are never documentation

The classifier SHALL hold one declared list of paths that are never documentation, whatever their suffix, and SHALL judge a list containing any of them as `full`. The list is empty when this capability is introduced; a change that makes a program read a documentation file adds that file to it.

#### Scenario: A declared exception

- **WHEN** the declared list names `docs/read-by-a-test.md` and the paths are `docs/read-by-a-test.md`
- **THEN** the verdict is `full`

#### Scenario: Nothing is excepted by default

- **WHEN** the declared list is the one this capability ships with, and the paths are `docs/backlog.md`
- **THEN** the verdict is `docs-only`

### Requirement: The classifier runs without installed dependencies and fails closed

The classifier SHALL be runnable as a command, with Node.js alone and no installed dependencies, reading newline-separated paths on standard input, ignoring blank lines, and printing exactly `docs-only` or `full`. Every caller SHALL treat any other output, or a non-zero exit, as `full`.

#### Scenario: Verdict on standard input

- **WHEN** the command receives `docs/a.md` followed by a blank line on standard input
- **THEN** it prints `docs-only` and exits with status 0

#### Scenario: Empty input

- **WHEN** the command receives nothing on standard input
- **THEN** it prints `full` and exits with status 0

#### Scenario: Mixed input

- **WHEN** the command receives `docs/a.md` and `package.json` on standard input
- **THEN** it prints `full` and exits with status 0
