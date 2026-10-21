import { Public } from '@basis/shared-infrastructure';
import { Controller, Get, Inject } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config/index.js';

export interface HealthReport {
  status: 'ok';
  version: string;
}

// The build identifier the process was started with, baked into the image
// (deploy-api-skeleton design decision 2), taken from the validated
// configuration. It needs no session (add-identity-authentication).
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  report(): HealthReport {
    return { status: 'ok', version: this.config.appVersion };
  }
}
