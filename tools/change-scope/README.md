# change-scope

Decides whether a set of changed paths is documentation-only (`scaffold-workspace` design decision 11). The commit hook, the push hook and CI call it; none restates the rule.

```sh
git diff --name-only --no-renames origin/main...HEAD | node tools/change-scope/src/docs-only.ts
```

It prints `docs-only` or `full`. A caller treats any other output, or a non-zero exit, as `full`. It uses Node.js built-ins only, so it runs before `pnpm install`.

A change that makes code, a test or a build read a Markdown file adds that file to `DOCUMENTATION_EXCEPTIONS`.
