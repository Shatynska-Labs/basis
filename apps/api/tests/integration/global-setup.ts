// One PostgreSQL server per integration run, its URL provided to every spec as
// `postgresUrl` (add-persistence-skeleton design decision 8). A failed start
// is not caught: the run fails rather than skipping its specs.
import { startPostgres, type StartedPostgres } from '@basis/shared-testing';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The integration run's server, as a superuser connection URL. */
    postgresUrl: string;
  }
}

interface Project {
  provide: (key: 'postgresUrl', value: string) => void;
}

export async function setup(
  project: Project,
  start: () => Promise<StartedPostgres> = startPostgres,
): Promise<() => Promise<void>> {
  const server = await start();
  project.provide('postgresUrl', server.url);
  return () => server.stop();
}
