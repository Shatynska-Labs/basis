// The migration process: `node dist/migrate.js`, run once by the `migrate`
// service before each delivery's API starts (add-persistence-skeleton design
// decisions 3 and 4). It applies every migration in ../migrations not yet
// applied to the database DATABASE_URL names, and exits 0, or 1 on any
// failure without printing the URL or its password.
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { APPLICATION_NAME, readDatabaseUrl } from './database/database-url.js';

const migrationsFolder = fileURLToPath(
  new URL('../migrations', import.meta.url),
);

// Every form in which the URL or its password could reach a message.
const secretsOf = (url: string): string[] => {
  const secrets = [url];
  try {
    const { password } = new URL(url);
    if (password) secrets.push(password, decodeURIComponent(password));
  } catch {
    // Unparsable: only the URL as a whole can be redacted.
  }
  return secrets.filter((secret) => secret.length > 0);
};

const redact = (text: string, secrets: readonly string[]): string =>
  secrets.reduce(
    (redacted, secret) => redacted.replaceAll(secret, '[redacted]'),
    text,
  );

// The message is redacted rather than withheld: a server's message is what
// makes a failed migration diagnosable. A Drizzle query error carries the
// driver's error as its cause.
const describeFailure = (
  error: unknown,
  secrets: readonly string[],
): string => {
  const parts: string[] = [];
  for (
    let current: unknown = error;
    current instanceof Error;
    current = current.cause
  ) {
    const code = (current as { code?: unknown }).code;
    parts.push(
      `${current.name}${typeof code === 'string' ? ` (${code})` : ''}: ${current.message}`,
    );
  }
  return redact(parts.length > 0 ? parts.join(' <- ') : String(error), secrets);
};

const run = async (): Promise<void> => {
  const url = readDatabaseUrl(process.env);
  const secrets = secretsOf(url);
  const pool = new pg.Pool({
    connectionString: url,
    application_name: `${APPLICATION_NAME}-migrate`,
  });
  // A connection failing while idle surfaces through the failing query.
  pool.on('error', () => undefined);
  try {
    await migrate(drizzle(pool), {
      migrationsFolder,
      migrationsSchema: 'drizzle',
    });
    console.log('Migrations applied.');
  } catch (error) {
    console.error(`Migrations failed: ${describeFailure(error, secrets)}`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
};

try {
  await run();
} catch (error) {
  // Only the configuration can fail before a URL is known.
  console.error(`Migrations failed: ${describeFailure(error, [])}`);
  process.exitCode = 1;
}
