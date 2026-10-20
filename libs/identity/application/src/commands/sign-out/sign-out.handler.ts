import { type Result, success } from '@basis/shared-core';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { Clock, SessionRepository } from '../../ports.js';
import { digestOf } from '../../session-token.js';
import { SignOut } from './sign-out.command.js';

@CommandHandler(SignOut)
export class SignOutHandler implements ICommandHandler<SignOut> {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute({ token, userId }: SignOut): Promise<Result<never, void>> {
    await this.sessions.revoke(digestOf(token), userId, this.clock.now());
    return success(undefined);
  }
}
