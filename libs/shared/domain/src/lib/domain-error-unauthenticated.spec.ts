// Derived from openspec/changes/add-identity-authentication/specs/shared-domain/spec.md
// before implementation: the MODIFIED "A domain error carries a kind, a code
// and a message", as revised to add the kind "unauthenticated". Provenance of
// each assertion is recorded in that change's test-plan.md. The type-level
// assertions are enforced by the `typecheck` target, not by the `test`
// target's runtime, as in domain-error.spec.ts.
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DomainError, type DomainErrorKind } from '../index.js';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

/** Found in domain-error.spec.ts. */
class HabitNotFound extends DomainError {
  readonly kind = 'not-found' as const;
  readonly code = 'habit.not-found';
}

class SessionMissing extends DomainError {
  readonly kind = 'unauthenticated' as const;
  readonly code = 'identity.example';
}

// ---------------------------------------------------------------------------

type FiveKinds =
  'not-found' | 'conflict' | 'rule-violated' | 'forbidden' | 'unauthenticated';

describe('shared-domain: a domain error carries a kind, a code and a message (as revised)', () => {
  it('a subclass declares its kind and code', () => {
    const error = new HabitNotFound('No such habit.');

    expect(error.kind).toBe('not-found');
    expect(error.code).toBe('habit.not-found');
    expect(error.message).toBe('No such habit.');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).not.toBeInstanceOf(Error);
  });

  it('the unauthenticated kind', () => {
    // Type-checks: "unauthenticated" is one of the kinds.
    const error = new SessionMissing('No session.');

    expect(error.kind).toBe('unauthenticated');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).not.toBeInstanceOf(Error);
  });

  it('only the four kinds type-check: "teapot" does not (the scenario keeps its recorded name; five kinds now type-check)', () => {
    class Teapot extends DomainError {
      // @ts-expect-error -- "teapot" is not one of the kinds
      readonly kind = 'teapot' as const;
      readonly code = 'habit.teapot';
    }
    void Teapot;

    // Specified by the requirement text: the kinds are exactly these five.
    expectTypeOf<DomainError['kind']>().toEqualTypeOf<FiveKinds>();
    expectTypeOf<DomainErrorKind>().toEqualTypeOf<FiveKinds>();
  });
});
