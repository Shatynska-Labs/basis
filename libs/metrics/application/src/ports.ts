// metrics' ports for the temporary Health Connect intake
// (validate-health-connect-data design decision 6). Each abstract class is
// its own injection token; the composition root binds the adapters.

/** A stored HC Webhook delivery: when it arrived, and its body unchanged. */
export interface StoredHealthConnectDelivery {
  receivedAt: Date;
  payload: unknown;
}

export abstract class HealthConnectDeliveryRepository {
  /** Stores a delivery for the user; the database records its arrival. */
  abstract add(userId: string, payload: Record<string, unknown>): Promise<void>;
}

export abstract class HealthConnectDeliveryReader {
  /** Every delivery the user has sent, oldest first. */
  abstract deliveriesOf(userId: string): Promise<StoredHealthConnectDelivery[]>;
}
