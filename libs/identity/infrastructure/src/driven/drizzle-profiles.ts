import {
  type ProfilePatch,
  ProfileReader,
  ProfileRepository,
  type StoredProfile,
} from '@basis/identity-application';
import { DATABASE, type Database } from '@basis/shared-infrastructure';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { profiles } from './schema.js';

// One statement per patch, changing only the columns present, so concurrent
// patches of different fields both apply (add-identity-profile design
// decision 3).
@Injectable()
export class DrizzleProfileRepository implements ProfileRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async update(userId: string, patch: ProfilePatch, at: Date): Promise<void> {
    await this.db
      .insert(profiles)
      .values({ userId, ...patch, updatedAt: at })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { ...patch, updatedAt: at },
      });
  }
}

@Injectable()
export class DrizzleProfileReader implements ProfileReader {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async profileOf(userId: string): Promise<StoredProfile> {
    const [row] = await this.db
      .select({
        timeZone: profiles.timeZone,
        birthYear: profiles.birthYear,
        enteredMaxHeartRate: profiles.enteredMaxHeartRate,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return (
      row ?? { timeZone: null, birthYear: null, enteredMaxHeartRate: null }
    );
  }
}
