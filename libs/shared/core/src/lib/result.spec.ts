// Derived from openspec/changes/scaffold-workspace/specs/shared-core/spec.md
// before implementation. Provenance of each assertion is recorded in that
// change's test-plan.md. The type-level assertions in "narrowing" are enforced
// by the `typecheck` target, not by the `test` target's runtime.
import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { failure, success, type Result } from '../index';

const falsyValues = [0, '', false, null, undefined] as const;

describe('Result: a result is either a success or a failure', () => {
  it('a success carries its value', () => {
    const carried = { id: 1 };

    const result = success(carried);

    expect(result.value).toBe(carried);
  });

  it('a failure carries its value', () => {
    const result = failure('not-found');

    expect(result.value).toBe('not-found');
  });

  it.each(falsyValues)(
    'a falsy value is still carried by success: %s',
    (carried) => {
      const result = success(carried);

      expect(result.isSuccess()).toBe(true);
      expect(result.isFailure()).toBe(false);
      expect(result.value).toBe(carried);
    },
  );

  it.each(falsyValues)(
    'a falsy value is still carried by failure: %s',
    (carried) => {
      const result = failure(carried);

      expect(result.isFailure()).toBe(true);
      expect(result.isSuccess()).toBe(false);
      expect(result.value).toBe(carried);
    },
  );
});

describe('Result: a result reports which it is', () => {
  it('a success reports success', () => {
    const result = success(42);

    expect(result.isSuccess()).toBe(true);
    expect(result.isFailure()).toBe(false);
  });

  it('a failure reports failure', () => {
    const result = failure('not-found');

    expect(result.isFailure()).toBe(true);
    expect(result.isSuccess()).toBe(false);
  });

  it('a check narrows the value type', () => {
    const lookUp = (found: boolean): Result<string, number> =>
      found ? success(7) : failure('not-found');

    for (const found of [true, false]) {
      const result = lookUp(found);

      if (result.isSuccess()) {
        expectTypeOf(result.value).toEqualTypeOf<number>();
        const asNumber: number = result.value;
        // @ts-expect-error -- after isSuccess() the value is the success type, not the failure type
        const asString: string = result.value;
        expect(asNumber).toBe(7);
        void asString;
      } else {
        expectTypeOf(result.value).toEqualTypeOf<string>();
        const asString: string = result.value;
        expect(asString).toBe('not-found');
      }

      if (result.isFailure()) {
        expectTypeOf(result.value).toEqualTypeOf<string>();
        // @ts-expect-error -- after isFailure() the value is the failure type, not the success type
        const asNumber: number = result.value;
        void asNumber;
      } else {
        expectTypeOf(result.value).toEqualTypeOf<number>();
      }
    }
  });
});

/**
 * Test-local helper: the runtime dependency names a package manifest declares.
 * Runtime means `dependencies`, `peerDependencies` and `optionalDependencies`;
 * `devDependencies` are not shipped to consumers.
 */
const declaredRuntimeDependencies = (
  manifest: Record<string, unknown>,
): string[] =>
  ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap(
    (field) => {
      const declared = manifest[field];
      return declared && typeof declared === 'object'
        ? Object.keys(declared)
        : [];
    },
  );

describe('Result: the shared core depends on nothing', () => {
  it('the shared core is used without a framework', () => {
    const ok: Result<string, number> = success(1);
    const notOk: Result<string, number> = failure('not-found');

    expect(ok.isSuccess()).toBe(true);
    expect(notOk.isFailure()).toBe(true);

    const manifest = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>;

    expect(declaredRuntimeDependencies(manifest)).toEqual([]);
  });

  it('the dependency check detects a declared runtime dependency (fixture)', () => {
    expect(
      declaredRuntimeDependencies({ dependencies: { 'left-pad': '1.3.0' } }),
    ).toEqual(['left-pad']);
    expect(
      declaredRuntimeDependencies({ peerDependencies: { react: '19.0.0' } }),
    ).toEqual(['react']);
    expect(
      declaredRuntimeDependencies({
        optionalDependencies: { fsevents: '2.3.3' },
      }),
    ).toEqual(['fsevents']);
    expect(
      declaredRuntimeDependencies({
        name: '@basis/shared-core',
        dependencies: {},
      }),
    ).toEqual([]);
    expect(
      declaredRuntimeDependencies({ devDependencies: { vitest: '3.0.0' } }),
    ).toEqual([]);
  });
});
