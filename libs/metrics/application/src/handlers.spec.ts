// Unit specs of metrics' handlers with in-memory fakes of the ports
// (AGENTS.md, Testing Strategy; validate-health-connect-data design decision
// 9). The same behaviour is observed over HTTP against PostgreSQL in
// apps/api/tests/integration/health-connect-intake.integration.spec.ts;
// these run without Docker.
import { describe, expect, it } from 'vitest';

import { RecordHealthConnectDelivery } from './commands/record-health-connect-delivery/record-health-connect-delivery.command.js';
import { RecordHealthConnectDeliveryHandler } from './commands/record-health-connect-delivery/record-health-connect-delivery.handler.js';
import type {
  HealthConnectDeliveryReader,
  HealthConnectDeliveryRepository,
  StoredHealthConnectDelivery,
} from './ports.js';
import { SummarizeHealthConnectDeliveries } from './queries/summarize-health-connect-deliveries/summarize-health-connect-deliveries.query.js';
import { SummarizeHealthConnectDeliveriesHandler } from './queries/summarize-health-connect-deliveries/summarize-health-connect-deliveries.handler.js';

/** Deliveries in memory, behind the repository and reader ports. */
const memory = () => {
  const rows: (StoredHealthConnectDelivery & { userId: string })[] = [];
  const repository: HealthConnectDeliveryRepository = {
    add: async (userId, payload) => {
      rows.push({ userId, receivedAt: new Date(), payload });
    },
  };
  const reader: HealthConnectDeliveryReader = {
    deliveriesOf: async (userId) =>
      rows
        .filter((row) => row.userId === userId)
        .map(({ receivedAt, payload }) => ({ receivedAt, payload })),
  };
  return { rows, repository, reader };
};

const delivery = {
  timestamp: '2026-10-22T08:00:00Z',
  app_version: '1.9.25',
  steps: [{ count: 120, end_time: '2026-10-22T07:15:00Z' }],
};

describe('metrics handlers', () => {
  it('RecordHealthConnectDelivery stores the payload unchanged for its user', async () => {
    const { rows, repository } = memory();

    await new RecordHealthConnectDeliveryHandler(repository).execute(
      new RecordHealthConnectDelivery('u1', delivery),
    );

    expect(rows).toEqual([
      { userId: 'u1', receivedAt: expect.any(Date), payload: delivery },
    ]);
  });

  it('RecordHealthConnectDelivery stores a repeated delivery again', async () => {
    const { rows, repository } = memory();
    const handler = new RecordHealthConnectDeliveryHandler(repository);

    await handler.execute(new RecordHealthConnectDelivery('u1', delivery));
    await handler.execute(new RecordHealthConnectDelivery('u1', delivery));

    expect(rows).toHaveLength(2);
  });

  it("SummarizeHealthConnectDeliveries summarises only its user's deliveries", async () => {
    const { repository, reader } = memory();
    await repository.add('u1', delivery);
    await repository.add('u1', delivery);
    await repository.add('u2', delivery);

    const summary = await new SummarizeHealthConnectDeliveriesHandler(
      reader,
    ).execute(new SummarizeHealthConnectDeliveries('u2'));

    expect(summary.deliveries.count).toBe(1);
    expect(summary.types['steps']?.records).toBe(1);
  });
});
