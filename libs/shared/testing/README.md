# shared-testing

The project's shared test arrangement: builders, fixtures, fakes and stubs that specs import (`scope:shared`, `type:testing`; `share-the-test-arrangement`).

- It ships empty. Arrangement enters when a second spec needs it; a fake of a port stays in the spec that uses it until a change decides where such fakes live.
- It depends on no other workspace library, so a spec in any library can import it without a project cycle. Helpers are generic and carry no domain types.
- Only spec files, files under `tests/` and test or lint configuration may import it; ESLint reports any other import (`eslint.config.mjs`). Violations are fixed, never silenced.
- A consumer adds it as a `devDependency` (`"@basis/shared-testing": "workspace:*"`) so the Nx graph sees the edge.
- It has no `build` target. A buildable consumer's specs are rejected by `enforceBuildableLibDependency`; the first such consumer gives this library a build target.
- Its `test` target is uncached: the spec checks the root `eslint.config.mjs`, which is not among the target's inputs.

Tests: `pnpm nx test shared-testing`.
