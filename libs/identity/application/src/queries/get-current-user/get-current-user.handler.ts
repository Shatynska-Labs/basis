import { failure, type Result, success } from '@basis/shared-core';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { InvalidSession } from '../../failures.js';
import { type CurrentUser, UserReader } from '../../ports.js';
import { GetCurrentUser } from './get-current-user.query.js';

// A session whose user no longer exists authenticates nobody.
@QueryHandler(GetCurrentUser)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUser> {
  constructor(private readonly users: UserReader) {}

  async execute({
    userId,
  }: GetCurrentUser): Promise<Result<InvalidSession, CurrentUser>> {
    const user = await this.users.currentUser(userId);
    return user === null ? failure(new InvalidSession()) : success(user);
  }
}
