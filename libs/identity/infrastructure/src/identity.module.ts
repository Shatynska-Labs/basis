import {
  Clock,
  GoogleIdTokenVerifier,
  IDENTITY_HANDLERS,
  SessionReader,
  SessionRepository,
  SIGN_UP_ALLOWLIST,
  UserReader,
  UserRepository,
} from '@basis/identity-application';
import {
  type DynamicModule,
  type InjectionToken,
  Logger,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { createRemoteJWKSet } from 'jose';

import {
  DrizzleSessionReader,
  DrizzleSessionRepository,
} from './driven/drizzle-sessions.js';
import {
  DrizzleUserReader,
  DrizzleUserRepository,
} from './driven/drizzle-users.js';
import {
  GOOGLE_KEY_SET_URL,
  JoseGoogleIdTokenVerifier,
} from './driven/jose-google-id-token-verifier.js';
import { SystemClock } from './driven/system-clock.js';
import { AuthController } from './driving/auth.controller.js';
import { MeController } from './driving/me.controller.js';
import { SessionGuard } from './driving/session.guard.js';

// identity's composition root, outside driving/ and driven/: it binds the
// driven adapters to the application's ports and registers the driving ones
// (add-identity-authentication design decision 5). The database comes from the
// shared DATABASE token, which the API provides globally.

export interface IdentityOptions {
  googleClientIds: readonly string[];
  signupAllowedEmails: readonly string[];
}

export interface IdentityModuleAsyncOptions {
  inject?: InjectionToken[];
  useFactory: (...args: never[]) => IdentityOptions;
}

const IDENTITY_OPTIONS = Symbol('IDENTITY_OPTIONS');

const googleIdTokenVerifier = ({ googleClientIds }: IdentityOptions) => {
  if (googleClientIds.length === 0) {
    new Logger('IdentityModule').warn(
      'Sign-in with Google is disabled: GOOGLE_CLIENT_IDS names no client.',
    );
  }
  return new JoseGoogleIdTokenVerifier({
    clientIds: googleClientIds,
    keySet: createRemoteJWKSet(GOOGLE_KEY_SET_URL),
  });
};

@Module({})
export class IdentityModule {
  static forRootAsync(options: IdentityModuleAsyncOptions): DynamicModule {
    return {
      module: IdentityModule,
      imports: [CqrsModule.forRoot()],
      controllers: [AuthController, MeController],
      providers: [
        {
          provide: IDENTITY_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        {
          provide: SIGN_UP_ALLOWLIST,
          inject: [IDENTITY_OPTIONS],
          useFactory: ({ signupAllowedEmails }: IdentityOptions) =>
            signupAllowedEmails,
        },
        {
          provide: GoogleIdTokenVerifier,
          inject: [IDENTITY_OPTIONS],
          useFactory: googleIdTokenVerifier,
        },
        { provide: Clock, useClass: SystemClock },
        { provide: UserRepository, useClass: DrizzleUserRepository },
        { provide: UserReader, useClass: DrizzleUserReader },
        { provide: SessionRepository, useClass: DrizzleSessionRepository },
        { provide: SessionReader, useClass: DrizzleSessionReader },
        ...IDENTITY_HANDLERS,
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
    };
  }
}
