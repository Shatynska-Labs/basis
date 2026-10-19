// The API's database is the one DATABASE_URL names, used unchanged
// (add-persistence-skeleton design decision 2). The value is never echoed.
export const readDatabaseUrl = (
  env: Readonly<Record<string, string | undefined>>,
): string => {
  const url = env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set; the API has no database.');
  }
  return url;
};

/** How the API names its connections to the database. */
export const APPLICATION_NAME = 'basis-api';
