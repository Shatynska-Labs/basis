import { Controller, Get } from '@nestjs/common';

export interface HealthReport {
  status: 'ok';
  version: string;
}

// The build identifier the process was started with, baked into the image
// (deploy-api-skeleton design decision 2), read once.
const version = process.env['APP_VERSION'] || 'unknown';

@Controller('health')
export class HealthController {
  @Get()
  report(): HealthReport {
    return { status: 'ok', version };
  }
}
