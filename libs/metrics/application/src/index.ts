import { RecordHealthConnectDeliveryHandler } from './commands/record-health-connect-delivery/record-health-connect-delivery.handler.js';
import { SummarizeHealthConnectDeliveriesHandler } from './queries/summarize-health-connect-deliveries/summarize-health-connect-deliveries.handler.js';

export * from './commands/record-health-connect-delivery/record-health-connect-delivery.command.js';
export * from './commands/record-health-connect-delivery/record-health-connect-delivery.handler.js';
export * from './ports.js';
export * from './queries/summarize-health-connect-deliveries/summarize-health-connect-deliveries.handler.js';
export * from './queries/summarize-health-connect-deliveries/summarize-health-connect-deliveries.query.js';
export { summarizeHealthConnectDeliveries } from './summarize-health-connect-deliveries.js';

/** Every handler of metrics' application, for its composition root. */
export const METRICS_HANDLERS = [
  RecordHealthConnectDeliveryHandler,
  SummarizeHealthConnectDeliveriesHandler,
];
