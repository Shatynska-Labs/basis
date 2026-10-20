import { GetCurrentUser } from '@basis/identity-application';
import type { CurrentUserResponse } from '@basis/identity-contracts';
import {
  type AuthenticatedUser,
  CurrentUser,
  toResponse,
} from '@basis/shared-infrastructure';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

@Controller('me')
export class MeController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentUserResponse> {
    return toResponse(
      await this.queryBus.execute(new GetCurrentUser(user.userId)),
    );
  }
}
