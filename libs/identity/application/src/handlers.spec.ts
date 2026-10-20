// Unit specs of identity's handlers with in-memory fakes of the ports
// (AGENTS.md, Testing Strategy; add-identity-authentication design decision
// 15). The same behaviour is observed over HTTP against PostgreSQL in
// apps/api/tests/integration/identity-authentication.integration.spec.ts;
// these run without Docker.
import { createHash } from 'node:crypto';

import { failure, success } from '@basis/shared-core';
import { describe, expect, it } from 'vitest';

import { SignInWithGoogle } from './commands/sign-in-with-google/sign-in-with-google.command.js';
import { SignInWithGoogleHandler } from './commands/sign-in-with-google/sign-in-with-google.handler.js';
import { SignOut } from './commands/sign-out/sign-out.command.js';
import { SignOutHandler } from './commands/sign-out/sign-out.handler.js';
import { InvalidIdToken } from './failures.js';
import type {
  Clock,
  CurrentUser,
  GoogleAccount,
  GoogleIdTokenVerifier,
  NewSession,
  SessionReader,
  SessionRepository,
  UserReader,
  UserRepository,
} from './ports.js';
import { AuthenticateSession } from './queries/authenticate-session/authenticate-session.query.js';
import { AuthenticateSessionHandler } from './queries/authenticate-session/authenticate-session.handler.js';
import { GetCurrentUser } from './queries/get-current-user/get-current-user.query.js';
import { GetCurrentUserHandler } from './queries/get-current-user/get-current-user.handler.js';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

interface StoredSession extends NewSession {
  revokedAt: Date | null;
}

/** Users and sessions in memory, behind the four repository and reader ports. */
const memory = () => {
  const users = new Map<string, CurrentUser & { subject: string }>();
  const sessions: StoredSession[] = [];
  const userRepository: UserRepository = {
    findIdBySubject: async (subject) =>
      [...users.values()].find((user) => user.subject === subject)?.id ?? null,
    save: async ({ subject, email, displayName }) => {
      const existing = [...users.values()].find((u) => u.subject === subject);
      const id = existing?.id ?? `user-${users.size + 1}`;
      users.set(id, { id, subject, email, displayName });
      return id;
    },
  };
  const sessionRepository: SessionRepository = {
    add: async (session) => {
      sessions.push({ ...session, revokedAt: null });
    },
    revoke: async (tokenHash, userId, at) => {
      for (const session of sessions)
        if (
          session.tokenHash === tokenHash &&
          session.userId === userId &&
          session.revokedAt === null
        )
          session.revokedAt = at;
    },
  };
  const userReader: UserReader = {
    currentUser: async (userId) => {
      const user = users.get(userId);
      return user
        ? { id: user.id, email: user.email, displayName: user.displayName }
        : null;
    },
  };
  const sessionReader: SessionReader = {
    userOf: async (tokenHash, now) =>
      sessions.find(
        (s) =>
          s.tokenHash === tokenHash &&
          s.revokedAt === null &&
          s.expiresAt.getTime() > now.getTime(),
      )?.userId ?? null,
  };
  return {
    users,
    sessions,
    userRepository,
    sessionRepository,
    userReader,
    sessionReader,
  };
};

const fixedClock = (iso: string) => {
  const clock = { current: new Date(iso), now: () => new Date(clock.current) };
  return clock satisfies Clock;
};

const verifierOf = (accounts: Record<string, GoogleAccount>) =>
  ({
    verify: async (idToken: string) =>
      accounts[idToken]
        ? success(accounts[idToken])
        : failure(new InvalidIdToken()),
  }) satisfies GoogleIdTokenVerifier;

const ANN: GoogleAccount = {
  subject: '1098',
  email: 'Ann@Example.org',
  displayName: 'Ann',
};

const setUp = (allowlist: string[] = ['ann@example.org']) => {
  const store = memory();
  const clock = fixedClock('2026-10-20T10:00:00Z');
  const signIn = new SignInWithGoogleHandler(
    verifierOf({ 'ann-token': ANN }),
    store.userRepository,
    store.sessionRepository,
    clock,
    allowlist,
  );
  const authenticate = new AuthenticateSessionHandler(
    store.sessionReader,
    clock,
  );
  const signOut = new SignOutHandler(store.sessionRepository, clock);
  const me = new GetCurrentUserHandler(store.userReader);
  return { store, clock, signIn, authenticate, signOut, me };
};

describe('SignInWithGoogle', () => {
  it('an allowed email, matched in lower case, creates an account and a 30-day session stored as a digest', async () => {
    const { store, signIn } = setUp();

    const result = await signIn.execute(new SignInWithGoogle('ann-token'));

    expect(result.isSuccess()).toBe(true);
    if (!result.isSuccess()) return;
    expect(result.value.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.value.expiresAt.toISOString()).toBe(
      '2026-11-19T10:00:00.000Z',
    );
    expect(store.users.size).toBe(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]?.tokenHash).toBe(sha256(result.value.token));
  });

  it('an invalid token fails and creates nothing', async () => {
    const { store, signIn } = setUp();

    const result = await signIn.execute(new SignInWithGoogle('other'));

    expect(result.isFailure() && result.value.code).toBe(
      'identity.invalid-id-token',
    );
    expect(store.users.size).toBe(0);
    expect(store.sessions).toHaveLength(0);
  });

  it('an email not on the list fails with sign-up-not-allowed and creates nothing', async () => {
    const { store, signIn } = setUp(['bob@example.org']);

    const result = await signIn.execute(new SignInWithGoogle('ann-token'));

    expect(result.isFailure() && result.value.code).toBe(
      'identity.sign-up-not-allowed',
    );
    expect(store.users.size).toBe(0);
  });

  it('a known account signs in whether or not its email is on the list', async () => {
    const { store, signIn } = setUp([]);
    await store.userRepository.save(ANN);

    const result = await signIn.execute(new SignInWithGoogle('ann-token'));

    expect(result.isSuccess()).toBe(true);
  });
});

describe('AuthenticateSession, SignOut and GetCurrentUser', () => {
  const signedIn = async () => {
    const context = setUp();
    const result = await context.signIn.execute(
      new SignInWithGoogle('ann-token'),
    );
    if (!result.isSuccess()) throw new Error('sign-in failed');
    return { ...context, token: result.value.token };
  };

  it('a session authenticates its user, who can be read', async () => {
    const { authenticate, me, token } = await signedIn();

    const session = await authenticate.execute(new AuthenticateSession(token));
    expect(session.isSuccess()).toBe(true);
    if (!session.isSuccess()) return;
    const user = await me.execute(new GetCurrentUser(session.value.userId));

    expect(user.isSuccess() && user.value).toEqual({
      id: session.value.userId,
      email: 'Ann@Example.org',
      displayName: 'Ann',
    });
  });

  it('a session authenticates nobody once expired', async () => {
    const { authenticate, clock, token } = await signedIn();
    clock.current = new Date('2026-11-19T10:00:00Z');

    const session = await authenticate.execute(new AuthenticateSession(token));

    expect(session.isFailure() && session.value.code).toBe(
      'identity.invalid-session',
    );
  });

  it('an unknown token authenticates nobody', async () => {
    const { authenticate } = await signedIn();

    const session = await authenticate.execute(new AuthenticateSession('nope'));

    expect(session.isFailure()).toBe(true);
  });

  it('sign-out revokes the presented session only', async () => {
    const context = await signedIn();
    const second = await context.signIn.execute(
      new SignInWithGoogle('ann-token'),
    );
    if (!second.isSuccess()) throw new Error('sign-in failed');
    const first = await context.authenticate.execute(
      new AuthenticateSession(context.token),
    );
    if (!first.isSuccess()) throw new Error('no session');

    await context.signOut.execute(
      new SignOut(context.token, first.value.userId),
    );

    expect(
      (
        await context.authenticate.execute(
          new AuthenticateSession(context.token),
        )
      ).isFailure(),
    ).toBe(true);
    expect(
      (
        await context.authenticate.execute(
          new AuthenticateSession(second.value.token),
        )
      ).isSuccess(),
    ).toBe(true);
  });

  it('a user who no longer exists cannot be read', async () => {
    const { me } = setUp();

    const user = await me.execute(new GetCurrentUser('user-gone'));

    expect(user.isFailure() && user.value.code).toBe(
      'identity.invalid-session',
    );
  });
});
