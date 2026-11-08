import { SignInWithGoogleHandler } from './commands/sign-in-with-google/sign-in-with-google.handler.js';
import { SignOutHandler } from './commands/sign-out/sign-out.handler.js';
import { UpdateProfileHandler } from './commands/update-profile/update-profile.handler.js';
import { AuthenticateSessionHandler } from './queries/authenticate-session/authenticate-session.handler.js';
import { GetCurrentUserHandler } from './queries/get-current-user/get-current-user.handler.js';
import { GetProfileHandler } from './queries/get-profile/get-profile.handler.js';

export * from './commands/sign-in-with-google/sign-in-with-google.command.js';
export * from './commands/sign-in-with-google/sign-in-with-google.handler.js';
export * from './commands/sign-out/sign-out.command.js';
export * from './commands/sign-out/sign-out.handler.js';
export * from './commands/update-profile/update-profile.command.js';
export * from './commands/update-profile/update-profile.handler.js';
export * from './failures.js';
export * from './ports.js';
export * from './queries/authenticate-session/authenticate-session.handler.js';
export * from './queries/authenticate-session/authenticate-session.query.js';
export * from './queries/get-current-user/get-current-user.handler.js';
export * from './queries/get-current-user/get-current-user.query.js';
export * from './queries/get-profile/get-profile.handler.js';
export * from './queries/get-profile/get-profile.query.js';
export type {
  HeartRateZone,
  MaxHeartRate,
  Profile,
} from './profile/heart-rate.js';
export { SESSION_LIFETIME_MS } from './session-token.js';

/** Every handler of identity's application, for its composition root. */
export const IDENTITY_HANDLERS = [
  SignInWithGoogleHandler,
  SignOutHandler,
  AuthenticateSessionHandler,
  GetCurrentUserHandler,
  UpdateProfileHandler,
  GetProfileHandler,
];
