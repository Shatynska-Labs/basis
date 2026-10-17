// Decides whether a set of changed paths is documentation-only, so the commit
// hook, the push hook and CI can stand down the project checks for it
// (scaffold-workspace design decision 11). This file is the one declaration of
// the rule: no caller restates it.
//
// It runs as `node tools/change-scope/src/docs-only.ts` before dependencies are
// installed, so it imports Node built-ins only and uses erasable syntax only.

import { readFileSync } from 'node:fs';

export type Verdict = 'docs-only' | 'full';

// Paths that are never documentation, whatever their suffix. A change that
// makes code, a test or a build read, import, bundle or copy a Markdown file
// adds that file here.
export const DOCUMENTATION_EXCEPTIONS: readonly string[] = [];

// `git diff --name-only` prints repository-relative paths only. Anything else
// means the input is not what the rule was written for, so it is not
// documentation.
const isRepositoryRelative = (path: string): boolean =>
  !path.startsWith('/') &&
  path
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');

const isDocumentation = (path: string): boolean =>
  isRepositoryRelative(path) &&
  (path.endsWith('.md') ||
    (path.startsWith('openspec/') && path.endsWith('.yaml')));

export const classify = (
  paths: readonly string[],
  exceptions: readonly string[] = DOCUMENTATION_EXCEPTIONS,
): Verdict =>
  paths.length > 0 &&
  paths.every((path) => !exceptions.includes(path) && isDocumentation(path))
    ? 'docs-only'
    : 'full';

if (import.meta.main) {
  const paths = readFileSync(0, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');
  process.stdout.write(`${classify(paths)}\n`);
}
