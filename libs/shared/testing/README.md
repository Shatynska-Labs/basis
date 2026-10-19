# shared-testing

The project's shared test arrangement: builders, fixtures, fakes and stubs that specs import (`scope:shared`, `type:testing`; `share-the-test-arrangement`).

- Arrangement enters when a second spec needs it; a fake of a port stays in the spec that uses it until a change decides where such fakes live.
- **PostgreSQL for integration specs** (`add-persistence-skeleton`): `startPostgres()` starts a throwaway server of the hosts' shared instance's image (`POSTGRES_IMAGE`) through Testcontainers, for a project's Vitest `globalSetup`, which `provide`s its URL as `postgresUrl` (declaring that key on Vitest's `ProvidedContext`, as `apps/api/tests/integration/global-setup.ts` does); a spec takes it with `inject('postgresUrl')` and calls `freshDatabase(url)` for an empty database of its own. Testcontainers needs a container runtime and fails without one; a global setup must not catch that failure.
- It depends on no other workspace library, so a spec in any library can import it without a project cycle. Helpers are generic and carry no domain types.
- Only spec files, files under `tests/` and test or lint configuration may import it; ESLint reports any other import (`eslint.config.mjs`). Violations are fixed, never silenced.
- A consumer adds it as a `devDependency` (`"@basis/shared-testing": "workspace:*"`) so the Nx graph sees the edge.
- It has no `build` target. A buildable consumer's specs are rejected by `enforceBuildableLibDependency`; the first such consumer gives this library a build target.
- Its `test` target is uncached: the spec checks the root `eslint.config.mjs`, which is not among the target's inputs.

Tests: `pnpm nx test shared-testing`.
