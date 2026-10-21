import { failure, type Result, success } from '@basis/shared-core';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { InvalidSession } from '../../failures.js';
import { Clock, SessionReader } from '../../ports.js';
import { digestOf } from '../../session-token.js';
import {
  AuthenticateSession,
  type SessionUser,
} from './authenticate-session.query.js';

// A session authenticates while it is unrevoked and unexpired
// (add-identity-authentication design decision 2).
@QueryHandler(AuthenticateSession)
export class AuthenticateSessionHandler implements IQueryHandler<AuthenticateSession> {
  constructor(
    private readonly sessions: SessionReader,
    private readonly clock: Clock,
  ) {}

  async execute({
    token,
  }: AuthenticateSession): Promise<Result<InvalidSession, SessionUser>> {
    const userId = await this.sessions.userOf(
      digestOf(token),
      this.clock.now(),
    );
    return userId === null
      ? failure(new InvalidSession())
      : success({ userId });
  }
}
