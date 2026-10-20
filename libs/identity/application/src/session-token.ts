import { createHash, randomBytes } from 'node:crypto';

// A session token is 32 random bytes, base64url, returned once; only its
// SHA-256 digest is stored (add-identity-authentication design decision 2).

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export const newSessionToken = (): string =>
  randomBytes(32).toString('base64url');

export const digestOf = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
