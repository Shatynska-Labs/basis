import { Module } from '@nestjs/common';

import { ConfigModule } from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { HttpModule } from './http/index.js';

@Module({
  imports: [ConfigModule, DatabaseModule, HttpModule],
  controllers: [HealthController],
})
export class AppModule {}
