import {
  type NewSession,
  SessionReader,
  SessionRepository,
} from '@basis/identity-application';
import { DATABASE, type Database } from '@basis/shared-infrastructure';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { sessions } from './schema.js';

@Injectable()
export class DrizzleSessionRepository implements SessionRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async add(session: NewSession): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async revoke(tokenHash: string, userId: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at })
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
        ),
      );
  }
}

@Injectable()
export class DrizzleSessionReader implements SessionReader {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async userOf(tokenHash: string, now: Date): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      );
    return row?.userId ?? null;
  }
}
