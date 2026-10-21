import { SignInWithGoogleHandler } from './commands/sign-in-with-google/sign-in-with-google.handler.js';
import { SignOutHandler } from './commands/sign-out/sign-out.handler.js';
import { AuthenticateSessionHandler } from './queries/authenticate-session/authenticate-session.handler.js';
import { GetCurrentUserHandler } from './queries/get-current-user/get-current-user.handler.js';

export * from './commands/sign-in-with-google/sign-in-with-google.command.js';
export * from './commands/sign-in-with-google/sign-in-with-google.handler.js';
export * from './commands/sign-out/sign-out.command.js';
export * from './commands/sign-out/sign-out.handler.js';
export * from './failures.js';
export * from './ports.js';
export * from './queries/authenticate-session/authenticate-session.handler.js';
export * from './queries/authenticate-session/authenticate-session.query.js';
export * from './queries/get-current-user/get-current-user.handler.js';
export * from './queries/get-current-user/get-current-user.query.js';
export { SESSION_LIFETIME_MS } from './session-token.js';

/** Every handler of identity's application, for its composition root. */
export const IDENTITY_HANDLERS = [
  SignInWithGoogleHandler,
  SignOutHandler,
  AuthenticateSessionHandler,
  GetCurrentUserHandler,
];
