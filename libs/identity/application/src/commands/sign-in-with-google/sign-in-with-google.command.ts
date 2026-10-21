import type { Result } from '@basis/shared-core';
import { Command } from '@nestjs/cqrs';

import type { InvalidIdToken, SignUpNotAllowed } from '../../failures.js';

export interface OpenedSession {
  token: string;
  expiresAt: Date;
}

export class SignInWithGoogle extends Command<
  Result<InvalidIdToken | SignUpNotAllowed, OpenedSession>
> {
  constructor(readonly idToken: string) {
    super();
  }
}
