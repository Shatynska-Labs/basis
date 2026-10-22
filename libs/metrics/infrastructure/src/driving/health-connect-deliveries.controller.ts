import {
  RecordHealthConnectDelivery,
  SummarizeHealthConnectDeliveries,
} from '@basis/metrics-application';
import {
  HealthConnectDeliveryRequest,
  type HealthConnectSummaryResponse,
} from '@basis/metrics-contracts';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '@basis/shared-infrastructure';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

// The temporary Health Connect intake: HC Webhook posts here with the
// caller's session token (validate-health-connect-data design decisions 1, 2
// and 4). Nothing of a delivery is logged (decision 8).
@Controller('health-connect/deliveries')
export class HealthConnectDeliveriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(204)
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: HealthConnectDeliveryRequest })
    delivery: HealthConnectDeliveryRequest,
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordHealthConnectDelivery(user.userId, delivery),
    );
  }

  @Get('summary')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HealthConnectSummaryResponse> {
    return this.queryBus.execute(
      new SummarizeHealthConnectDeliveries(user.userId),
    );
  }
}
