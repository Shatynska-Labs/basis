import { failure, type Result, success } from '@basis/shared-core';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { ImplausibleBirthYear } from '../../failures.js';
import {
  Clock,
  type ProfilePatch,
  ProfileReader,
  ProfileRepository,
} from '../../ports.js';
import {
  currentYear,
  type Profile,
  profileAt,
} from '../../profile/heart-rate.js';
import { UpdateProfile } from './update-profile.command.js';

const presentFields = (patch: ProfilePatch): ProfilePatch => {
  const present: ProfilePatch = {};
  if (patch.timeZone !== undefined) present.timeZone = patch.timeZone;
  if (patch.birthYear !== undefined) present.birthYear = patch.birthYear;
  if (patch.enteredMaxHeartRate !== undefined) {
    present.enteredMaxHeartRate = patch.enteredMaxHeartRate;
  }
  return present;
};

// The birth year is checked against the year in the zone the patch leaves,
// then the present fields are written in one statement; an empty patch writes
// nothing (add-identity-profile design decisions 3 and 6).
@CommandHandler(UpdateProfile)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfile> {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly profiles: ProfileReader,
    private readonly clock: Clock,
  ) {}

  async execute({
    userId,
    patch,
  }: UpdateProfile): Promise<Result<ImplausibleBirthYear, Profile>> {
    const now = this.clock.now();
    const present = presentFields(patch);
    if (Object.keys(present).length > 0) {
      if (present.birthYear !== undefined && present.birthYear !== null) {
        const stored = await this.profiles.profileOf(userId);
        const year = currentYear(now, present.timeZone ?? stored.timeZone);
        if (present.birthYear < year - 120 || present.birthYear > year - 10) {
          return failure(new ImplausibleBirthYear());
        }
      }
      await this.repository.update(userId, present, now);
    }
    return success(profileAt(await this.profiles.profileOf(userId), now));
  }
}
