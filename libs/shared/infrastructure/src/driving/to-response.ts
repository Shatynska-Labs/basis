import { problem, ProblemException } from './problem.js';

// A driving HTTP adapter's answer to a handler's result
// (add-api-cross-cutting-basics design decision 7). The failure's kind sets
// the status here, once, for every context.
//
// The shapes of `Result` (@basis/shared-core) and `DomainError`
// (@basis/shared-domain) that this reads are declared here: a buildable
// library cannot import a non-buildable one, even for types. apps/api's specs
// pass a real `DomainError` through `toResponse`, so their typecheck fails if
// the shared domain gains a kind this map lacks.

export type DomainFailureKind =
  'not-found' | 'conflict' | 'rule-violated' | 'forbidden';

/** What `toResponse` reads of a `DomainError`. */
export interface DomainFailure {
  readonly kind: DomainFailureKind;
  readonly code: string;
  readonly message: string;
}

/** What `toResponse` reads of a `Result<DomainError, S>`. */
export interface DomainOutcome<S> {
  isFailure(): boolean;
  readonly value: S | DomainFailure;
}

const STATUS_BY_KIND: Record<DomainFailureKind, number> = {
  'not-found': 404,
  conflict: 409,
  'rule-violated': 422,
  forbidden: 403,
};

/** The success's value, or a thrown {@link ProblemException} for the failure. */
export const toResponse = <S>(result: DomainOutcome<S>): S => {
  if (result.isFailure()) {
    const { kind, code, message } = result.value as DomainFailure;
    throw new ProblemException(
      problem(STATUS_BY_KIND[kind], { detail: message, code }),
    );
  }
  return result.value as S;
};
