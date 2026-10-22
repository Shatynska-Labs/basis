import {
  HealthConnectDeliveryReader,
  HealthConnectDeliveryRepository,
  type StoredHealthConnectDelivery,
} from '@basis/metrics-application';
import { DATABASE, type Database } from '@basis/shared-infrastructure';
import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { healthConnectDeliveries } from './schema.js';

/**
 * Storing a delivery failed. Thrown in place of the query's own error, whose
 * message holds the query's parameters, the delivery among them, and would
 * reach the log (validate-health-connect-data design decision 8).
 */
export class HealthConnectDeliveryNotStored extends Error {
  constructor() {
    super('The Health Connect delivery could not be stored.');
    this.name = 'HealthConnectDeliveryNotStored';
  }
}

@Injectable()
export class DrizzleHealthConnectDeliveryRepository implements HealthConnectDeliveryRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async add(userId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.db.insert(healthConnectDeliveries).values({ userId, payload });
    } catch {
      throw new HealthConnectDeliveryNotStored();
    }
  }
}

@Injectable()
export class DrizzleHealthConnectDeliveryReader implements HealthConnectDeliveryReader {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async deliveriesOf(userId: string): Promise<StoredHealthConnectDelivery[]> {
    return this.db
      .select({
        receivedAt: healthConnectDeliveries.receivedAt,
        payload: healthConnectDeliveries.payload,
      })
      .from(healthConnectDeliveries)
      .where(eq(healthConnectDeliveries.userId, userId))
      .orderBy(asc(healthConnectDeliveries.receivedAt));
  }
}
