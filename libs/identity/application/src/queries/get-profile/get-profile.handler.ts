import { type Result, success } from '@basis/shared-core';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Clock, ProfileReader } from '../../ports.js';
import { type Profile, profileAt } from '../../profile/heart-rate.js';
import { GetProfile } from './get-profile.query.js';

// The stored profile with the maximum heart rate and zones in effect now
// (add-identity-profile design decision 7).
@QueryHandler(GetProfile)
export class GetProfileHandler implements IQueryHandler<GetProfile> {
  constructor(
    private readonly profiles: ProfileReader,
    private readonly clock: Clock,
  ) {}

  async execute({ userId }: GetProfile): Promise<Result<never, Profile>> {
    return success(
      profileAt(await this.profiles.profileOf(userId), this.clock.now()),
    );
  }
}
