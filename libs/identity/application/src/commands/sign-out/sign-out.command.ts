import type { Result } from '@basis/shared-core';
import { Command } from '@nestjs/cqrs';

/** Revokes the session the request presented (add-identity-authentication design decision 7). */
export class SignOut extends Command<Result<never, void>> {
  constructor(
    readonly token: string,
    readonly userId: string,
  ) {
    super();
  }
}
