import {
  type CurrentUser,
  type GoogleAccount,
  UserReader,
  UserRepository,
} from '@basis/identity-application';
import { DATABASE, type Database } from '@basis/shared-infrastructure';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { users } from './schema.js';

@Injectable()
export class DrizzleUserRepository implements UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findIdBySubject(subject: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.googleSubject, subject));
    return row?.id ?? null;
  }

  // One statement, so concurrent first sign-ins of a subject yield one user
  // (add-identity-authentication design decision 6).
  async save({ subject, email, displayName }: GoogleAccount): Promise<string> {
    const [row] = await this.db
      .insert(users)
      .values({ googleSubject: subject, email, displayName })
      .onConflictDoUpdate({
        target: users.googleSubject,
        set: { email, displayName },
      })
      .returning({ id: users.id });
    if (!row) throw new Error('Saving a user returned no row.');
    return row.id;
  }
}

@Injectable()
export class DrizzleUserReader implements UserReader {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async currentUser(userId: string): Promise<CurrentUser | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId));
    return row ?? null;
  }
}
