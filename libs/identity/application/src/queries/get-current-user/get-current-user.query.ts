import type { Result } from '@basis/shared-core';
import { Query } from '@nestjs/cqrs';

import type { InvalidSession } from '../../failures.js';
import type { CurrentUser } from '../../ports.js';

export class GetCurrentUser extends Query<Result<InvalidSession, CurrentUser>> {
  constructor(readonly userId: string) {
    super();
  }
}
