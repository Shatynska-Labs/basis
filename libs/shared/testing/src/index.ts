// Shared test arrangement enters here when a second spec needs it; see README.md.
export {
  freshDatabase,
  POSTGRES_IMAGE,
  startPostgres,
  type StartedPostgres,
} from './lib/postgres.js';
