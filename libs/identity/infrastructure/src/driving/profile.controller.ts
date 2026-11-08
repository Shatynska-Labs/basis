import { GetProfile, UpdateProfile } from '@basis/identity-application';
import {
  type ProfileResponse,
  UpdateProfileRequest,
} from '@basis/identity-contracts';
import {
  type AuthenticatedUser,
  CurrentUser,
  toResponse,
} from '@basis/shared-infrastructure';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

// The caller's profile (add-identity-profile design decision 8).
@Controller('me/profile')
export class ProfileController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  async profile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProfileResponse> {
    return toResponse(await this.queryBus.execute(new GetProfile(user.userId)));
  }

  @Patch()
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: UpdateProfileRequest }) body: UpdateProfileRequest,
  ): Promise<ProfileResponse> {
    return toResponse(
      await this.commandBus.execute(new UpdateProfile(user.userId, body)),
    );
  }
}
