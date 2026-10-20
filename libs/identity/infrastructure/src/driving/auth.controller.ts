import { SignInWithGoogle, SignOut } from '@basis/identity-application';
import {
  SessionResponse,
  SignInWithGoogleRequest,
} from '@basis/identity-contracts';
import {
  type AuthenticatedUser,
  CurrentUser,
  Public,
  toResponse,
} from '@basis/shared-infrastructure';
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { bearerTokenOf } from './bearer-token.js';

// Signing in with Google and out (add-identity-authentication design
// decision 8).
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Post('google')
  @HttpCode(200)
  async signIn(
    @Body({ schema: SignInWithGoogleRequest }) body: SignInWithGoogleRequest,
  ): Promise<SessionResponse> {
    const { token, expiresAt } = toResponse(
      await this.commandBus.execute(new SignInWithGoogle(body.idToken)),
    );
    return { token, expiresAt: expiresAt.toISOString() };
  }

  // The guard has already authenticated the presented token.
  @Post('sign-out')
  @HttpCode(204)
  async signOut(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<void> {
    const token = bearerTokenOf(authorization);
    if (token === undefined) {
      throw new Error('Sign-out was reached without a bearer token.');
    }
    toResponse(await this.commandBus.execute(new SignOut(token, user.userId)));
  }
}
