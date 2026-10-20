import { STATUS_CODES } from 'node:http';

import { HttpException } from '@nestjs/common';

// An error response as an RFC 9457 problem document
// (add-api-cross-cutting-basics design decision 5). No problem types are
// published, so `type` is always `about:blank` and `title` the status's
// reason phrase.

export interface ProblemIssue {
  path: (string | number)[];
  message: string;
}

export interface Problem {
  type: 'about:blank';
  title: string;
  status: number;
  detail?: string;
  /** A domain failure's code. */
  code?: string;
  /** A validation failure's issues. */
  errors?: ProblemIssue[];
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const problem = (
  status: number,
  extras: Pick<Problem, 'detail' | 'code' | 'errors'> = {},
): Problem => ({
  type: 'about:blank',
  title: STATUS_CODES[status] ?? 'Error',
  status,
  ...extras,
});

/** Answers the request with {@link problem}, rendered by the API's exception filter. */
export class ProblemException extends HttpException {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem, problem.status);
    this.problem = problem;
  }
}
