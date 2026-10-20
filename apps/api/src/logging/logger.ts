import { ConsoleLogger } from '@nestjs/common';

// The API's logger: one JSON object per line, with secret-named properties of
// structured params masked (add-api-cross-cutting-basics design decision 4).
// Nest compares the names case-insensitively at any depth; the underscore is
// not bridged, so camelCase and snake_case forms are both listed. Message
// strings, error messages and stacks are printed as is: a secret goes only
// into structured params, never into a message string.
export const SECRET_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'databaseUrl',
  'database_url',
  'connectionString',
  'connection_string',
] as const;

export const createLogger = (): ConsoleLogger =>
  new ConsoleLogger({ json: true, colors: false, redact: [...SECRET_KEYS] });
