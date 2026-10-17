// Derived from openspec/changes/scaffold-workspace/specs/change-scope/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md. The export names `classify` and
// `DOCUMENTATION_EXCEPTIONS` were fixed by the test author (design decision 11
// leaves them open); the implementation must use them.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { classify, DOCUMENTATION_EXCEPTIONS } from './docs-only.ts';

const script = fileURLToPath(new URL('./docs-only.ts', import.meta.url));

const runCommand = (input: string, path = script, cwd?: string) =>
  spawnSync(process.execPath, [path], {
    input,
    encoding: 'utf8',
    timeout: 10_000,
    cwd,
  });

// "prints exactly `docs-only` or `full`": the verdict word, optionally followed
// by a single line terminator, and nothing else.
const verdictOutput = (verdict: 'docs-only' | 'full') =>
  new RegExp(`^${verdict}\\r?\\n?$`);

describe('classify: a change is documentation-only only when every path is documentation', () => {
  it('markdown only', () => {
    expect(
      classify(['docs/backlog.md', 'AGENTS.md', 'libs/shared/core/README.md']),
    ).toBe('docs-only');
  });

  it('a change record', () => {
    expect(
      classify([
        'openspec/changes/archive/2026-10-17-x/proposal.md',
        'openspec/changes/archive/2026-10-17-x/.openspec.yaml',
      ]),
    ).toBe('docs-only');
  });

  it('markdown beside code', () => {
    expect(classify(['docs/backlog.md', 'libs/shared/core/src/index.ts'])).toBe(
      'full',
    );
  });

  it('yaml outside the change records', () => {
    expect(classify(['docs/a.md', '.github/workflows/ci.yml'])).toBe('full');
  });

  it('a suffix in another case', () => {
    expect(classify(['docs/NOTES.MD'])).toBe('full');
  });

  it.each(['openspec/../x.yaml', '/abs/docs/a.md', './docs/a.md'])(
    'a path that is not repository-relative: %s',
    (path) => {
      expect(classify([path])).toBe('full');
    },
  );

  it('a deleted or renamed source file', () => {
    expect(classify(['docs/a.md', 'libs/shared/core/src/lib/result.ts'])).toBe(
      'full',
    );
  });

  it('nothing changed', () => {
    expect(classify([])).toBe('full');
  });

  // Requirement text beyond the scenarios.
  it('a .yaml file directly under openspec/ is documentation', () => {
    expect(classify(['openspec/config.yaml'])).toBe('docs-only');
  });

  it('a .yaml file outside openspec/ is not documentation', () => {
    expect(classify(['docs/a.yaml'])).toBe('full');
    expect(classify(['openspec.yaml'])).toBe('full');
    expect(classify(['openspecs/a.yaml'])).toBe('full');
  });

  it('a .yaml suffix in another case is not documentation', () => {
    expect(classify(['openspec/changes/x/.openspec.YAML'])).toBe('full');
  });

  it.each(['docs//a.md', 'docs/a.md/../b.md', 'docs/../AGENTS.md'])(
    'a path with an empty or .. segment is not documentation: %s',
    (path) => {
      expect(classify([path])).toBe('full');
    },
  );

  it('one non-documentation path anywhere in the list makes it full', () => {
    expect(classify(['package.json', 'docs/a.md'])).toBe('full');
  });

  // Derived: interpretations the requirement text does not settle.
  it('.yml under openspec/ is not documentation', () => {
    expect(classify(['openspec/changes/x/config.yml'])).toBe('full');
  });

  it('a nested directory named openspec is not the change records', () => {
    expect(classify(['docs/openspec/a.yaml'])).toBe('full');
  });
});

describe('classify: declared exceptions are never documentation', () => {
  it('a declared exception', () => {
    expect(
      classify(['docs/read-by-a-test.md'], ['docs/read-by-a-test.md']),
    ).toBe('full');
  });

  it('nothing is excepted by default', () => {
    expect(classify(['docs/backlog.md'])).toBe('docs-only');
    expect(classify(['docs/backlog.md'], DOCUMENTATION_EXCEPTIONS)).toBe(
      'docs-only',
    );
  });

  // Requirement text beyond the scenarios.
  it('the declared list is empty when the capability is introduced', () => {
    expect(DOCUMENTATION_EXCEPTIONS).toEqual([]);
  });

  it('a declared exception among documentation still makes the list full', () => {
    expect(
      classify(
        ['docs/a.md', 'docs/read-by-a-test.md'],
        ['docs/read-by-a-test.md'],
      ),
    ).toBe('full');
  });

  it('an exception does not affect paths it does not name', () => {
    expect(classify(['docs/a.md'], ['docs/read-by-a-test.md'])).toBe(
      'docs-only',
    );
  });
});

describe('docs-only command: runs without installed dependencies and fails closed', () => {
  it('verdict on standard input', () => {
    const run = runCommand('docs/a.md\n\n');

    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(verdictOutput('docs-only'));
  });

  it('empty input', () => {
    const run = runCommand('');

    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(verdictOutput('full'));
  });

  it('mixed input', () => {
    const run = runCommand('docs/a.md\npackage.json\n');

    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(verdictOutput('full'));
  });

  // Requirement text: "with Node.js alone and no installed dependencies".
  it('runs from a copy outside the workspace, where no dependency can resolve', () => {
    const dir = mkdtempSync(join(tmpdir(), 'change-scope-'));
    try {
      const copy = join(dir, 'docs-only.ts');
      copyFileSync(script, copy);

      const run = runCommand('docs/a.md\n', copy, dir);

      expect(run.status).toBe(0);
      expect(run.stdout).toMatch(verdictOutput('docs-only'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blank lines between paths are ignored', () => {
    const run = runCommand('\ndocs/a.md\n\nAGENTS.md\n');

    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(verdictOutput('docs-only'));
  });

  it('the output check rejects anything but the bare verdict (fixture)', () => {
    expect('docs-only\n').toMatch(verdictOutput('docs-only'));
    expect('docs-only').toMatch(verdictOutput('docs-only'));
    expect('full\n').not.toMatch(verdictOutput('docs-only'));
    expect('verdict: docs-only\n').not.toMatch(verdictOutput('docs-only'));
    expect('docs-only\nfull\n').not.toMatch(verdictOutput('docs-only'));
    expect('').not.toMatch(verdictOutput('full'));
  });
});
