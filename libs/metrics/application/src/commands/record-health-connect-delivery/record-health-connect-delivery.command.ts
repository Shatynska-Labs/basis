import { Command } from '@nestjs/cqrs';

export class RecordHealthConnectDelivery extends Command<void> {
  constructor(
    readonly userId: string,
    readonly payload: Record<string, unknown>,
  ) {
    super();
  }
}
