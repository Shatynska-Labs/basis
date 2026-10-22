import {
  HealthConnectDeliveryReader,
  HealthConnectDeliveryRepository,
  METRICS_HANDLERS,
} from '@basis/metrics-application';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import {
  DrizzleHealthConnectDeliveryReader,
  DrizzleHealthConnectDeliveryRepository,
} from './driven/drizzle-health-connect-deliveries.js';
import { HealthConnectDeliveriesController } from './driving/health-connect-deliveries.controller.js';

// metrics' composition root, outside driving/ and driven/ (ADR-0012 §1;
// validate-health-connect-data design decision 6). The database comes from
// the shared DATABASE token, which the API provides globally.
@Module({
  imports: [CqrsModule.forRoot()],
  controllers: [HealthConnectDeliveriesController],
  providers: [
    {
      provide: HealthConnectDeliveryRepository,
      useClass: DrizzleHealthConnectDeliveryRepository,
    },
    {
      provide: HealthConnectDeliveryReader,
      useClass: DrizzleHealthConnectDeliveryReader,
    },
    ...METRICS_HANDLERS,
  ],
})
export class MetricsModule {}
