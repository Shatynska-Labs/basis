import { problem, ProblemException } from '@basis/shared-infrastructure';
import {
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from '@nestjs/common';

type Issues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0];

// Validates every route parameter whose decorator names a schema, handing the
// handler the parsed value (add-api-cross-cutting-basics design decision 9).
export const createValidationPipe = (): StandardSchemaValidationPipe =>
  new StandardSchemaValidationPipe({
    transform: true,
    exceptionFactory: (issues: Issues) =>
      new ProblemException(
        problem(400, {
          detail: 'The request is invalid.',
          errors: issues.map((issue) => ({
            path: (issue.path ?? []).map((segment) =>
              typeof segment === 'object' ? segment.key : segment,
            ) as (string | number)[],
            message: issue.message,
          })),
        }),
      ),
  });
