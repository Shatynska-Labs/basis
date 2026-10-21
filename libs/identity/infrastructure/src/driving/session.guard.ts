import { AuthenticateSession } from '@basis/identity-application';
import {
  IS_PUBLIC,
  problem,
  ProblemException,
  setAuthenticatedUser,
} from '@basis/shared-infrastructure';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QueryBus } from '@nestjs/cqrs';

import { bearerTokenOf } from './bearer-token.js';

interface Request {
  headers: { authorization?: string };
}

const refusal = () =>
  new ProblemException(
    problem(401, {
      detail: 'Authentication is required.',
      code: 'identity.invalid-session',
    }),
    { 'WWW-Authenticate': 'Bearer' },
  );

// Every route requires a session unless declared public
// (add-identity-authentication design decision 7).
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly queryBus: QueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = bearerTokenOf(request.headers.authorization);
    if (token === undefined) throw refusal();

    const session = await this.queryBus.execute(new AuthenticateSession(token));
    if (session.isFailure()) throw refusal();
    setAuthenticatedUser(request, session.value);
    return true;
  }
}
