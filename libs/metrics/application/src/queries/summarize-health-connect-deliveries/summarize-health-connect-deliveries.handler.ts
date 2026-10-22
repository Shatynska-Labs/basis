import type { HealthConnectSummaryResponse } from '@basis/metrics-contracts';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HealthConnectDeliveryReader } from '../../ports.js';
import { summarizeHealthConnectDeliveries } from '../../summarize-health-connect-deliveries.js';
import { SummarizeHealthConnectDeliveries } from './summarize-health-connect-deliveries.query.js';

@QueryHandler(SummarizeHealthConnectDeliveries)
export class SummarizeHealthConnectDeliveriesHandler implements IQueryHandler<SummarizeHealthConnectDeliveries> {
  constructor(private readonly deliveries: HealthConnectDeliveryReader) {}

  async execute({
    userId,
  }: SummarizeHealthConnectDeliveries): Promise<HealthConnectSummaryResponse> {
    return summarizeHealthConnectDeliveries(
      await this.deliveries.deliveriesOf(userId),
    );
  }
}
