import { z } from 'zod';

// identity's public surface (ADR-0012 §1): the request and response shapes of
// signing in and of the current user (add-identity-authentication design
// decision 5).

export const SignInWithGoogleRequest = z.object({
  idToken: z.string().min(1),
});
export type SignInWithGoogleRequest = z.infer<typeof SignInWithGoogleRequest>;

export const SessionResponse = z.object({
  token: z.string(),
  /** ISO 8601, with an offset. */
  expiresAt: z.iso.datetime({ offset: true }),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const CurrentUserResponse = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
});
export type CurrentUserResponse = z.infer<typeof CurrentUserResponse>;
