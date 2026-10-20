import type { Result } from '@basis/shared-core';
import { Query } from '@nestjs/cqrs';

import type { InvalidSession } from '../../failures.js';

export interface SessionUser {
  userId: string;
}

export class AuthenticateSession extends Query<
  Result<InvalidSession, SessionUser>
> {
  constructor(readonly token: string) {
    super();
  }
}
