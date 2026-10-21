import {
  type Problem,
  problem,
  PROBLEM_CONTENT_TYPE,
  ProblemException,
} from '@basis/shared-infrastructure';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';

// Every error response is a problem document (add-api-cross-cutting-basics
// design decisions 5 and 8). A defect, and an HTTP exception of 500 or above,
// discloses nothing to the client and is logged; a 4xx is not logged. A
// problem's own headers, such as a 401's `WWW-Authenticate`, are sent with it
// (add-identity-authentication design decision 7).

/** The part of Express's response the filter uses. */
interface ProblemResponse {
  status(code: number): this;
  set(field: Record<string, string>): this;
  type(contentType: string): this;
  send(body: string): this;
}

/** An `http-errors` client error, such as the body parser's 413, marked safe to show. */
const exposedClientStatus = (thrown: unknown): number | undefined => {
  if (typeof thrown !== 'object' || thrown === null) return undefined;
  const { expose, status, statusCode } = thrown as Record<string, unknown>;
  const code = typeof status === 'number' ? status : statusCode;
  return expose === true &&
    typeof code === 'number' &&
    code >= 400 &&
    code < 500
    ? code
    : undefined;
};

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(thrown: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ProblemResponse>();
    const body = this.problemFor(thrown);
    if (
      thrown instanceof ProblemException &&
      thrown.headers &&
      body.status < 500
    ) {
      response.set({ ...thrown.headers });
    }
    response
      .status(body.status)
      .type(PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(body));
  }

  private problemFor(thrown: unknown): Problem {
    if (thrown instanceof HttpException && thrown.getStatus() < 500) {
      return thrown instanceof ProblemException
        ? thrown.problem
        : problem(thrown.getStatus(), { detail: thrown.message });
    }
    const clientStatus = exposedClientStatus(thrown);
    if (clientStatus !== undefined) return problem(clientStatus);
    this.logDefect(thrown);
    return problem(thrown instanceof HttpException ? thrown.getStatus() : 500);
  }

  // Any other thrown value may hold anything, so only its type is logged.
  private logDefect(thrown: unknown): void {
    if (thrown instanceof Error) {
      this.logger.error(`${thrown.name}: ${thrown.message}`, thrown.stack);
    } else {
      this.logger.error(`A value of type ${typeof thrown} was thrown.`);
    }
  }
}
