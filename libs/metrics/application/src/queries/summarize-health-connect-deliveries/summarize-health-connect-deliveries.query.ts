import type { HealthConnectSummaryResponse } from '@basis/metrics-contracts';
import { Query } from '@nestjs/cqrs';

export class SummarizeHealthConnectDeliveries extends Query<HealthConnectSummaryResponse> {
  constructor(readonly userId: string) {
    super();
  }
}
