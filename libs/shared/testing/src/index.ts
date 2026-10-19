// Shared test arrangement enters here when a second spec needs it; see README.md.
export {
  freshDatabase,
  POSTGRES_IMAGE,
  startPostgres,
  type StartedPostgres,
  withClient,
} from './lib/postgres.js';
