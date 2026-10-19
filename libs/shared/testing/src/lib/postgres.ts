// A throwaway PostgreSQL server per integration run, and a fresh database per
// spec on it (add-persistence-skeleton design decision 8).
import { randomUUID } from 'node:crypto';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

// The image of the hosts' shared PostgreSQL instance, `platform/docker-compose.yml`
// in the infrastructure repository (Shatynska-Labs/infrastructure). Follow it
// when that file moves.
export const POSTGRES_IMAGE = 'postgres:18.6';

export interface StartedPostgres {
  /** A superuser connection URL to the server's default database. */
  url: string;
  /** Stops and removes the container. */
  stop: () => Promise<void>;
}

/**
 * Starts a PostgreSQL server in a container. Rejects, and starts nothing,
 * when no container runtime can be reached.
 */
export async function startPostgres(): Promise<StartedPostgres> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop();
    },
  };
}

/**
 * Creates a new, empty database on the server `serverUrl` reaches, named
 * uniquely, and returns a URL to it with the same credentials.
 */
export async function freshDatabase(serverUrl: string): Promise<string> {
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: serverUrl });
  await client.connect();
  try {
    await client.query(`create database "${name}"`);
  } finally {
    await client.end();
  }
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
}
