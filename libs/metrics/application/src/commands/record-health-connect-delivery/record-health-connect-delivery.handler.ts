import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { HealthConnectDeliveryRepository } from '../../ports.js';
import { RecordHealthConnectDelivery } from './record-health-connect-delivery.command.js';

// Stored as received: no interpretation, deduplication or merging
// (validate-health-connect-data design decision 2).
@CommandHandler(RecordHealthConnectDelivery)
export class RecordHealthConnectDeliveryHandler implements ICommandHandler<RecordHealthConnectDelivery> {
  constructor(private readonly deliveries: HealthConnectDeliveryRepository) {}

  async execute({
    userId,
    payload,
  }: RecordHealthConnectDelivery): Promise<void> {
    await this.deliveries.add(userId, payload);
  }
}
