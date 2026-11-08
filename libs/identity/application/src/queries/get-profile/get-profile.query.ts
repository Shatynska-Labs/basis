import type { Result } from '@basis/shared-core';
import { Query } from '@nestjs/cqrs';

import type { Profile } from '../../profile/heart-rate.js';

export class GetProfile extends Query<Result<never, Profile>> {
  constructor(readonly userId: string) {
    super();
  }
}
