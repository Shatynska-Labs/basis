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
  'not-found' | 'conflict' | 'rule-violated' | 'forbidden' | 'unauthenticated';

/** What `toResponse` reads of a `DomainError`. */
export interface DomainFailure {
  readonly kind: DomainFailureKind;
  readonly code: string;
  readonly message: string;
}

/**
 * What `toResponse` reads of a `Result<DomainError, S>`: a failure or a
 * success, told apart by `kind` as `Result` does, so the success's type is
 * inferred from a `Result` union.
 */
export type DomainOutcome<S> =
  | {
      readonly kind: 'failure';
      readonly value: DomainFailure;
      isFailure(): boolean;
    }
  | { readonly kind: 'success'; readonly value: S; isFailure(): boolean };

const STATUS_BY_KIND: Record<DomainFailureKind, number> = {
  'not-found': 404,
  conflict: 409,
  'rule-violated': 422,
  forbidden: 403,
  unauthenticated: 401,
};

// RFC 9110 §15.5.2: a 401 names the scheme it expects
// (add-identity-authentication design decision 9).
const HEADERS_BY_KIND: Partial<
  Record<DomainFailureKind, Record<string, string>>
> = {
  unauthenticated: { 'WWW-Authenticate': 'Bearer' },
};

/** The success's value, or a thrown {@link ProblemException} for the failure. */
export const toResponse = <S>(result: DomainOutcome<S>): S => {
  if (result.isFailure()) {
    const { kind, code, message } = result.value as DomainFailure;
    throw new ProblemException(
      problem(STATUS_BY_KIND[kind], { detail: message, code }),
      HEADERS_BY_KIND[kind],
    );
  }
  return result.value as S;
};
