import {
  type GoogleAccount,
  GoogleIdTokenVerifier,
  InvalidIdToken,
} from '@basis/identity-application';
import { failure, type Result, success } from '@basis/shared-core';
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Verifies a Google ID token against Google's published keys
// (add-identity-authentication design decision 1). A token failing a check is
// `InvalidIdToken`; failing to obtain the keys is not the client's fault, so
// it is thrown and answered as a defect.

/** Where Google publishes the keys its ID tokens are signed with. */
export const GOOGLE_KEY_SET_URL = new URL(
  'https://www.googleapis.com/oauth2/v3/certs',
);

const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// The codes jose gives a token that fails verification, as opposed to a key
// set that could not be fetched or read.
const TOKEN_FAULTS = new Set([
  errors.JWTClaimValidationFailed.code,
  errors.JWTExpired.code,
  errors.JWTInvalid.code,
  errors.JWSInvalid.code,
  errors.JWSSignatureVerificationFailed.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWKSMultipleMatchingKeys.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
]);

const isTokenFault = (thrown: unknown): boolean =>
  thrown instanceof errors.JOSEError && TOKEN_FAULTS.has(thrown.code);

export interface JoseGoogleIdTokenVerifierOptions {
  clientIds: readonly string[];
  keySet: JWTVerifyGetKey;
}

export class JoseGoogleIdTokenVerifier implements GoogleIdTokenVerifier {
  constructor(private readonly options: JoseGoogleIdTokenVerifierOptions) {}

  async verify(
    idToken: string,
  ): Promise<Result<InvalidIdToken, GoogleAccount>> {
    const { clientIds, keySet } = this.options;
    if (clientIds.length === 0) return failure(new InvalidIdToken());

    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, keySet, {
        issuer: ISSUERS,
        audience: [...clientIds],
        algorithms: ['RS256'],
        clockTolerance: 30,
      }));
    } catch (thrown) {
      if (isTokenFault(thrown)) return failure(new InvalidIdToken());
      throw thrown;
    }

    const { sub, email, email_verified: emailVerified, name } = payload;
    if (
      emailVerified !== true ||
      typeof sub !== 'string' ||
      typeof email !== 'string'
    ) {
      return failure(new InvalidIdToken());
    }
    return success({
      subject: sub,
      email,
      displayName: typeof name === 'string' ? name : null,
    });
  }
}
