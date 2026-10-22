import { IdentityModule } from '@basis/identity-infrastructure';
import { MetricsModule } from '@basis/metrics-infrastructure';
import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig, ConfigModule } from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { HttpModule } from './http/index.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HttpModule,
    // identity takes its settings from the validated configuration, never the
    // configuration's type (add-identity-authentication design decision 5).
    IdentityModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        googleClientIds: config.googleClientIds,
        signupAllowedEmails: config.signupAllowedEmails,
      }),
    }),
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
