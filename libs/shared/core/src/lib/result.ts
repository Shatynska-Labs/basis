// An expected failure is returned rather than thrown (ADR-0012 §5): `domain` and
// application handlers return a `Result`, and driving adapters map it.

// `kind` tells the two classes apart structurally, so a check still narrows
// when the failure and success types are the same.
export class Failure<F, S> {
  readonly kind = 'failure';
  readonly value: F;

  constructor(value: F) {
    this.value = value;
  }

  isSuccess(): this is Success<F, S> {
    return false;
  }

  isFailure(): this is Failure<F, S> {
    return true;
  }
}

export class Success<F, S> {
  readonly kind = 'success';
  readonly value: S;

  constructor(value: S) {
    this.value = value;
  }

  isSuccess(): this is Success<F, S> {
    return true;
  }

  isFailure(): this is Failure<F, S> {
    return false;
  }
}

export type Result<F, S> = Failure<F, S> | Success<F, S>;

export const failure = <F, S>(value: F): Result<F, S> => new Failure(value);

export const success = <F, S>(value: S): Result<F, S> => new Success(value);
