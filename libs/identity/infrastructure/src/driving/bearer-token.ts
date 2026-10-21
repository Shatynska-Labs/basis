// The token of an `Authorization: Bearer <token>` header, the scheme matched
// case-insensitively; none for any other header (add-identity-authentication
// design decision 7). The guard and sign-out read the header through it.
export const bearerTokenOf = (
  authorization: string | undefined,
): string | undefined => {
  const match = /^bearer\s+(\S+)\s*$/i.exec(authorization ?? '');
  return match?.[1];
};
