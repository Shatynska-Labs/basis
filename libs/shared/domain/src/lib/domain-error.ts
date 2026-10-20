// An expected failure of the domain or of an application handler, returned in
// a `Result`, never thrown (ADR-0012 §5). It is not an `Error`: a stack would
// suggest a throw. `kind` is domain-neutral; driving adapters map it to their
// own terms, such as an HTTP status.

export type DomainErrorKind =
  'not-found' | 'conflict' | 'rule-violated' | 'forbidden' | 'unauthenticated';

export abstract class DomainError {
  abstract readonly kind: DomainErrorKind;
  abstract readonly code: string;
  readonly message: string;

  constructor(message: string) {
    this.message = message;
  }
}
