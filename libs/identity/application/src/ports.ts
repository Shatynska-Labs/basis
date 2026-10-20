import type { Result } from '@basis/shared-core';

import type { InvalidIdToken } from './failures.js';

// The ports identity's handlers call, each an abstract class that serves as
// its own injection token. Read and write repositories are kept apart
// (ADR-0012 §1, §2; add-identity-authentication design decision 5).

/** The Google account a verified ID token names. */
export interface GoogleAccount {
  subject: string;
  email: string;
  displayName: string | null;
}

export abstract class GoogleIdTokenVerifier {
  /** Fails for a token failing any check; throws when Google's keys cannot be obtained. */
  abstract verify(
    idToken: string,
  ): Promise<Result<InvalidIdToken, GoogleAccount>>;
}

export abstract class Clock {
  abstract now(): Date;
}

export abstract class UserRepository {
  /** The identifier of the user with this Google subject, if there is one. */
  abstract findIdBySubject(subject: string): Promise<string | null>;
  /** Creates the user, or updates its email and display name; returns its identifier. */
  abstract save(account: GoogleAccount): Promise<string>;
}

export interface NewSession {
  tokenHash: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export abstract class SessionRepository {
  abstract add(session: NewSession): Promise<void>;
  /** Revokes the user's session with this digest, if it is not revoked already. */
  abstract revoke(tokenHash: string, userId: string, at: Date): Promise<void>;
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
}

export abstract class UserReader {
  abstract currentUser(userId: string): Promise<CurrentUser | null>;
}

export abstract class SessionReader {
  /** The user of the unrevoked session with this digest that expires after `now`. */
  abstract userOf(tokenHash: string, now: Date): Promise<string | null>;
}

/** The lowercased emails that may create an account. */
export const SIGN_UP_ALLOWLIST = Symbol('SIGN_UP_ALLOWLIST');
