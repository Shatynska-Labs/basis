import { DomainError } from '@basis/shared-domain';

// identity's expected failures, returned in a `Result`
// (add-identity-authentication design decision 5).

export class InvalidIdToken extends DomainError {
  readonly kind = 'unauthenticated';
  readonly code = 'identity.invalid-id-token';

  constructor() {
    super('The Google ID token is invalid.');
  }
}

export class SignUpNotAllowed extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'identity.sign-up-not-allowed';

  constructor() {
    super('This Google account may not create an account here.');
  }
}

export class InvalidSession extends DomainError {
  readonly kind = 'unauthenticated';
  readonly code = 'identity.invalid-session';

  constructor() {
    super('Authentication is required.');
  }
}

export class ImplausibleBirthYear extends DomainError {
  readonly kind = 'rule-violated';
  readonly code = 'identity.implausible-birth-year';

  constructor() {
    super('The birth year must be 10 to 120 years before the current year.');
  }
}
