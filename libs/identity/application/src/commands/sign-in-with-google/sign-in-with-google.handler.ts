import { failure, type Result, success } from '@basis/shared-core';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { type InvalidIdToken, SignUpNotAllowed } from '../../failures.js';
import {
  Clock,
  GoogleIdTokenVerifier,
  SessionRepository,
  SIGN_UP_ALLOWLIST,
  UserRepository,
} from '../../ports.js';
import {
  digestOf,
  newSessionToken,
  SESSION_LIFETIME_MS,
} from '../../session-token.js';
import {
  type OpenedSession,
  SignInWithGoogle,
} from './sign-in-with-google.command.js';

// A known Google account signs in; an unknown one creates an account only if
// its email is on the deployment's allowlist (add-identity-authentication
// design decisions 3, 4 and 6). Saving is an upsert, so concurrent first
// sign-ins of one subject yield one user.
@CommandHandler(SignInWithGoogle)
export class SignInWithGoogleHandler implements ICommandHandler<SignInWithGoogle> {
  constructor(
    private readonly verifier: GoogleIdTokenVerifier,
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
    @Inject(SIGN_UP_ALLOWLIST) private readonly allowlist: readonly string[],
  ) {}

  async execute({
    idToken,
  }: SignInWithGoogle): Promise<
    Result<InvalidIdToken | SignUpNotAllowed, OpenedSession>
  > {
    const verified = await this.verifier.verify(idToken);
    if (verified.isFailure()) return failure(verified.value);
    const account = verified.value;

    const known = await this.users.findIdBySubject(account.subject);
    if (
      known === null &&
      !this.allowlist.includes(account.email.toLowerCase())
    ) {
      return failure(new SignUpNotAllowed());
    }
    const userId = await this.users.save(account);

    const token = newSessionToken();
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + SESSION_LIFETIME_MS);
    await this.sessions.add({
      tokenHash: digestOf(token),
      userId,
      createdAt,
      expiresAt,
    });
    return success({ token, expiresAt });
  }
}
