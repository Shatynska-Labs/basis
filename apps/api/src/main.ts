import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
// Exit with status 0 after a clean close on SIGTERM, rather than re-raising the
// signal (design decision 3, task 1.3).
app.enableShutdownHooks([], { useProcessExit: true });
await app.listen(Number(process.env['PORT'] ?? 3000));
