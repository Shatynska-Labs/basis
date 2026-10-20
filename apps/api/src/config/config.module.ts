import { Global, Module } from '@nestjs/common';

import { loadConfig } from './config.js';

/** The validated {@link AppConfig}. */
export const APP_CONFIG = Symbol('APP_CONFIG');

// The factory runs when the module is created, so an invalid environment
// fails creation before anything listens (design decision 1).
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
