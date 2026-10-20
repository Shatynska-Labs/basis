import { z } from 'zod';

// The API's configuration, read from the environment once and validated as a
// whole (add-api-cross-cutting-basics design decision 1). A failure names
// each invalid variable with a fixed description, never Zod's issue text and
// never a value.

export interface AppConfig {
  /** `DATABASE_URL`, used unchanged (api-persistence). */
  databaseUrl: string;
  port: number;
  /** The build identifier `/health` reports. */
  appVersion: string;
}

/** An invalid variable and what it must be. */
export interface InvalidVariable {
  variable: string;
  description: string;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
  readonly variables: readonly InvalidVariable[];

  constructor(variables: readonly InvalidVariable[]) {
    super(
      `The API's configuration is invalid: ${variables
        .map(({ variable, description }) => `${variable} ${description}`)
        .join('; ')}.`,
    );
    this.variables = variables;
  }
}

// Unset and empty are the same: an orchestrator may render an absent value
// as an empty string.
const unsetIfEmpty = (value: unknown) => (value === '' ? undefined : value);

const DESCRIPTIONS: Record<string, string> = {
  DATABASE_URL: 'must be set to a PostgreSQL connection URL',
  PORT: 'must be a whole number from 1 to 65535, without a leading zero',
  APP_VERSION: 'must be a string',
};

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.preprocess(
    unsetIfEmpty,
    z
      .string()
      .regex(/^[1-9]\d{0,4}$/)
      .transform(Number)
      .refine((port) => port <= 65535)
      .default(3000),
  ),
  APP_VERSION: z.preprocess(unsetIfEmpty, z.string().default('unknown')),
});

export const loadConfig = (
  env: Readonly<Record<string, string | undefined>>,
): AppConfig => {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new ConfigError(
      names.map((variable) => ({
        variable,
        description: DESCRIPTIONS[variable] ?? 'is invalid',
      })),
    );
  }
  const { DATABASE_URL, PORT, APP_VERSION } = parsed.data;
  return { databaseUrl: DATABASE_URL, port: PORT, appVersion: APP_VERSION };
};
