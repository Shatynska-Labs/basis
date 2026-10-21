import {
  createParamDecorator,
  type CustomDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

// The caller of a route, as every context's controllers read it
// (add-identity-authentication design decision 7). `identity`'s guard
// authenticates the request and records the caller here; another context
// reads it through `CurrentUser` without depending on `identity`.

/** The authenticated caller of a route. */
export interface AuthenticatedUser {
  userId: string;
}

/** The metadata key `Public` sets, read by the session guard. */
export const IS_PUBLIC = 'basis:is-public';

/** Declares a route, or every route of a controller, reachable without a session. */
export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC, true);

const CALLER = Symbol('basis:authenticated-user');

interface WithCaller {
  [CALLER]?: AuthenticatedUser;
}

/** Records the request's authenticated caller; called by the session guard. */
export const setAuthenticatedUser = (
  request: object,
  user: AuthenticatedUser,
): void => {
  (request as WithCaller)[CALLER] = user;
};

/** The request's authenticated caller, if the session guard recorded one. */
export const authenticatedUserOf = (
  request: object,
): AuthenticatedUser | undefined => (request as WithCaller)[CALLER];

/**
 * The route's authenticated caller. On a public route requested without a
 * session there is none, and asking for it is a defect.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = authenticatedUserOf(
      context.switchToHttp().getRequest<object>(),
    );
    if (!user) {
      throw new Error('CurrentUser was read on a request without a session.');
    }
    return user;
  },
);
