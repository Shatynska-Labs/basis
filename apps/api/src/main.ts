import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig, ConfigError } from './config/index.js';
import { createLogger } from './logging/index.js';

// The logger comes first, so every entry, startup's included, is a JSON line
// (add-api-cross-cutting-basics design decisions 3 and 4).
const logger = createLogger();

const start = async (): Promise<void> => {
  // abortOnError: false makes a failed creation rethrow instead of aborting,
  // so the process exits with status 1 rather than by signal.
  const app = await NestFactory.create(AppModule, {
    logger,
    abortOnError: false,
  });
  // Exit with status 0 after a clean close on SIGTERM, rather than re-raising
  // the signal (deploy-api-skeleton design decision 3, task 1.3).
  app.enableShutdownHooks([], { useProcessExit: true });
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
};

try {
  await start();
} catch (error) {
  if (error instanceof ConfigError) {
    logger.error('Configuration is invalid.', { variables: error.variables });
  } else if (error instanceof Error) {
    logger.error(`${error.name}: ${error.message}`, error.stack, 'Startup');
  } else {
    logger.error(`A value of type ${typeof error} was thrown.`, 'Startup');
  }
  process.exitCode = 1;
}
