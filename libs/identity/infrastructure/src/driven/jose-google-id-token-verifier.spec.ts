// Derived from openspec/changes/add-identity-authentication/specs/identity-authentication/spec.md
// ("A Google ID token is verified before it is trusted") before
// implementation. Provenance of each assertion is recorded in that change's
// test-plan.md.
//
// `JoseGoogleIdTokenVerifier` is the adapter design decisions 1 and 5 name,
// in `libs/identity/infrastructure/src/driven/`. The change does not state
// its file name, its constructor or its method; this file assumes (an
// unresolved project question in test-plan.md):
//   - the file `jose-google-id-token-verifier.ts` beside this spec;
//   - `new JoseGoogleIdTokenVerifier({ clientIds, keySet })`, where
//     `keySet` is what jose's `createRemoteJWKSet` and `createLocalJWKSet`
//     return, injected in place of Google's remote set (design decision 15);
//   - `verify(idToken)` resolving to a `Result` (@basis/shared-core) whose
//     success is `{ subject, email, displayName }` and whose failure is the
//     application's `InvalidIdToken` (kind `unauthenticated`, code
//     `identity.invalid-id-token`), and rejecting where the key set cannot be
//     obtained (design decision 1).
// No test reaches Google: tokens are signed with locally generated RSA keys,
// and the key-set failures are provoked against a local HTTP server.
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  SignJWT,
} from 'jose';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { JoseGoogleIdTokenVerifier } from './jose-google-id-token-verifier.js';

const CLIENT_ID = '1-web.apps.googleusercontent.com';
const OTHER_CLIENT_ID = '2-android.apps.googleusercontent.com';
const KID = 'test-key-1';

// --- Declared locally (see "Missing shared arrangement" in test-plan.md) ---

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

interface Claims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: unknown;
  name?: string;
  /** Seconds since the epoch. */
  exp?: number;
  iat?: number;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Claims of a token that passes every check, overridable one by one. */
const validClaims = (overrides: Partial<Claims> = {}): Claims => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1098',
  email: 'ann@example.org',
  email_verified: true,
  name: 'Ann',
  iat: nowSeconds() - 60,
  exp: nowSeconds() + 3600,
  ...overrides,
});

/** Signs `claims` as an RS256 JWT with `key`, under the key ID `kid`. */
const sign = async (claims: Claims, key: KeyPair, kid = KID) => {
  const payload: Record<string, unknown> = { ...claims };
  for (const name of Object.keys(payload))
    if (payload[name] === undefined) delete payload[name];
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .sign(key.privateKey);
};

/** A key set holding the public half of `key` under `kid`. */
const localKeySet = async (key: KeyPair, kid = KID) => {
  const jwk: JWK = {
    ...(await exportJWK(key.publicKey)),
    kid,
    alg: 'RS256',
    use: 'sig',
  };
  return createLocalJWKSet({ keys: [jwk] });
};

/** A local HTTP server answering every request with `handle`. */
const serve = (handle: RequestListener) =>
  new Promise<{ server: Server; url: URL }>((resolve) => {
    const server = createServer(handle);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: new URL(`http://127.0.0.1:${port}/certs`) });
    });
  });

/** A port on which nothing listens: one a server held and released. */
const closedPortUrl = async () => {
  const { server, url } = await serve((_req, res) => res.end());
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return url;
};

// ---------------------------------------------------------------------------

describe('identity-authentication: a Google ID token is verified before it is trusted', () => {
  let key: KeyPair;
  let otherKey: KeyPair;

  beforeAll(async () => {
    key = await generateKeyPair('RS256', { extractable: true });
    otherKey = await generateKeyPair('RS256', { extractable: true });
  });

  const verifierFor = async (clientIds: readonly string[] = [CLIENT_ID]) =>
    new JoseGoogleIdTokenVerifier({
      clientIds,
      keySet: await localKeySet(key),
    });

  const expectRefused = (result: { isFailure(): boolean; value: unknown }) => {
    expect(result.isFailure()).toBe(true);
    const error = result.value as { kind?: unknown; code?: unknown };
    expect(error.kind).toBe('unauthenticated');
    expect(error.code).toBe('identity.invalid-id-token');
  };

  it('a valid token yields the Google account', async () => {
    const verifier = await verifierFor();

    const result = await verifier.verify(await sign(validClaims(), key));

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual({
      subject: '1098',
      email: 'ann@example.org',
      displayName: 'Ann',
    });
  });

  it('the issuer accounts.google.com without a scheme is accepted too (specified by the requirement text)', async () => {
    const verifier = await verifierFor();

    const result = await verifier.verify(
      await sign(validClaims({ iss: 'accounts.google.com' }), key),
    );

    expect(result.isSuccess()).toBe(true);
  });

  it('an audience matching the second configured client ID is accepted (specified by the requirement text "one of the configured client IDs")', async () => {
    const verifier = await verifierFor([CLIENT_ID, OTHER_CLIENT_ID]);

    const result = await verifier.verify(
      await sign(validClaims({ aud: OTHER_CLIENT_ID }), key),
    );

    expect(result.isSuccess()).toBe(true);
  });

  it('a token expired 10 seconds ago is accepted, within the 30 seconds of clock skew (specified by the requirement text)', async () => {
    const verifier = await verifierFor();

    const result = await verifier.verify(
      await sign(validClaims({ exp: nowSeconds() - 10 }), key),
    );

    expect(result.isSuccess()).toBe(true);
  });

  it('a token without a name', async () => {
    const verifier = await verifierFor();

    const result = await verifier.verify(
      await sign(validClaims({ name: undefined }), key),
    );

    expect(result.isSuccess()).toBe(true);
    expect(result.value).toEqual({
      subject: '1098',
      email: 'ann@example.org',
      displayName: null,
    });
  });

  describe('a token failing any check is refused', () => {
    it('signed by a key outside the key set, under a key ID the set does not hold', async () => {
      const verifier = await verifierFor();

      expectRefused(
        await verifier.verify(
          await sign(validClaims(), otherKey, 'unknown-key'),
        ),
      );
    });

    it('signed by a key outside the key set, under the key ID of a key the set holds', async () => {
      const verifier = await verifierFor();

      expectRefused(await verifier.verify(await sign(validClaims(), otherKey)));
    });

    it.each([
      ['another issuer', { iss: 'https://evil.example.org' }],
      ['another audience', { aud: '3-other.apps.googleusercontent.com' }],
      [
        'expired more than 30 seconds ago',
        { exp: nowSeconds() - 60, iat: nowSeconds() - 3600 },
      ],
      ['email_verified false', { email_verified: false }],
      ['email_verified absent', { email_verified: undefined }],
      [
        'email_verified the string "true" (derived: the requirement says the claim is true)',
        { email_verified: 'true' },
      ],
    ] as const)('a token with %s', async (_case, overrides) => {
      const verifier = await verifierFor();

      expectRefused(
        await verifier.verify(await sign(validClaims(overrides), key)),
      );
    });

    it.each([
      ['a string that is not a JWT', 'not-a-jwt'],
      [
        'a JWT-shaped string with a bogus signature',
        'eyJhbGciOiJSUzI1NiJ9.e30.c2ln',
      ],
      ['the empty string (derived)', ''],
    ])('%s', async (_case, token) => {
      const verifier = await verifierFor();

      expectRefused(await verifier.verify(token));
    });
  });

  describe("Google's key set cannot be obtained", () => {
    const servers: Server[] = [];

    afterEach(async () => {
      for (const server of servers.splice(0)) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    const remoteVerifier = (url: URL) =>
      new JoseGoogleIdTokenVerifier({
        clientIds: [CLIENT_ID],
        keySet: createRemoteJWKSet(url, {
          timeoutDuration: 300,
          cooldownDuration: 0,
        }),
      });

    /** Verification rejects; it does not resolve, in particular not to the invalid-id-token failure. */
    const expectDefect = async (verify: Promise<unknown>) => {
      let resolved: unknown = '(rejected)';
      await expect(
        verify.then((value) => {
          resolved = value;
          return value;
        }),
      ).rejects.toBeDefined();
      expect(resolved).toBe('(rejected)');
    };

    it('a non-200 answer: verification throws rather than failing as identity.invalid-id-token', async () => {
      const { server, url } = await serve((_req, res) => {
        res.statusCode = 503;
        res.end('unavailable');
      });
      servers.push(server);

      await expectDefect(
        remoteVerifier(url).verify(await sign(validClaims(), key)),
      );
    });

    it('a timeout: verification throws rather than failing as identity.invalid-id-token', async () => {
      // Accepts the request and never answers.
      const { server, url } = await serve(() => undefined);
      servers.push(server);

      await expectDefect(
        remoteVerifier(url).verify(await sign(validClaims(), key)),
      );
    });

    it('a network error: verification throws rather than failing as identity.invalid-id-token', async () => {
      const url = await closedPortUrl();

      await expectDefect(
        remoteVerifier(url).verify(await sign(validClaims(), key)),
      );
    });

    it('control: the same remote key set, answered, verifies the token (shows the failures above come from the key set)', async () => {
      const jwk: JWK = {
        ...(await exportJWK(key.publicKey)),
        kid: KID,
        alg: 'RS256',
        use: 'sig',
      };
      const { server, url } = await serve((_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: [jwk] }));
      });
      servers.push(server);

      const result = await remoteVerifier(url).verify(
        await sign(validClaims(), key),
      );

      expect(result.isSuccess()).toBe(true);
    });
  });

  describe('no client ID is configured', () => {
    it('an otherwise valid token fails with code identity.invalid-id-token', async () => {
      const verifier = await verifierFor([]);

      expectRefused(await verifier.verify(await sign(validClaims(), key)));
    });

    it('the token is refused before any verification: the key set is never consulted (derived from design decision 1)', async () => {
      let consulted = 0;
      const keySet = await localKeySet(key);
      const verifier = new JoseGoogleIdTokenVerifier({
        clientIds: [],
        keySet: ((...args: Parameters<typeof keySet>) => {
          consulted += 1;
          return keySet(...args);
        }) as typeof keySet,
      });

      expectRefused(await verifier.verify(await sign(validClaims(), key)));
      expect(consulted).toBe(0);
    });
  });
});
