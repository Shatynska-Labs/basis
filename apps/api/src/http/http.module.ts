import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { ProblemFilter } from './problem.filter.js';
import { createValidationPipe } from './validation.js';

// Registered as providers rather than in main.ts, so an application created
// from AppModule in a test gets them too (design decision 8).
@Module({
  providers: [
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class HttpModule {}
