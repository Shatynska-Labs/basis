import type { Result } from '@basis/shared-core';
import { Command } from '@nestjs/cqrs';

import type { ImplausibleBirthYear } from '../../failures.js';
import type { ProfilePatch } from '../../ports.js';
import type { Profile } from '../../profile/heart-rate.js';

/** Changes the fields the patch holds (add-identity-profile design decision 3). */
export class UpdateProfile extends Command<
  Result<ImplausibleBirthYear, Profile>
> {
  constructor(
    readonly userId: string,
    readonly patch: ProfilePatch,
  ) {
    super();
  }
}
