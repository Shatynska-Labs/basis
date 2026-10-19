// Derived from openspec/changes/add-persistence-skeleton/specs/integration-testing/spec.md
// ("An integration run without a container runtime fails", "Each integration
// run gets a throwaway PostgreSQL") before implementation, against the
// interface design decision 8 states: the global setup takes the start
// function as a parameter defaulting to `startPostgres`, which returns the
// server's URL and a stop function, does not catch its failure, and provides
// the URL. The setup's export (named `setup` or default), its parameter order
// `(project, start)`, the `{ url, stop }` shape and the provided key
// `postgresUrl` are assumptions recorded as unresolved project questions in
// the change's test-plan.md.
import { describe, expect, it, vi } from 'vitest';

import * as globalSetup from './global-setup.js';

type Start = () => Promise<{ url: string; stop: () => Promise<void> }>;
type Setup = (
  project: { provide: (key: string, value: unknown) => void },
  start?: Start,
) => Promise<unknown>;

const setup = ((globalSetup as Record<string, unknown>).setup ??
  (globalSetup as Record<string, unknown>).default) as Setup;

// Declared locally (see "Missing shared arrangement" in test-plan.md): a
// stand-in for the Vitest project the global setup provides into.
const fakeProject = () => ({
  provide: vi.fn<(key: string, value: unknown) => void>(),
});

describe('integration-testing: an integration run without a container runtime fails', () => {
  it('the setup rejects with the start error, and no connection URL is provided', async () => {
    const failure = new Error(
      'Could not find a working container runtime strategy',
    );
    const start = vi.fn<Start>().mockRejectedValue(failure);
    const project = fakeProject();

    await expect(setup(project, start)).rejects.toBe(failure);
    expect(start).toHaveBeenCalledTimes(1);
    expect(project.provide).not.toHaveBeenCalled();
  });
});

describe('integration-testing: each integration run gets a throwaway PostgreSQL', () => {
  it("the setup provides the started server's URL and stops the server when the run ends", async () => {
    const stop = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const start = vi
      .fn<Start>()
      .mockResolvedValue({ url: 'postgres://u:p@localhost:5/db', stop });
    const project = fakeProject();

    const teardown = await setup(project, start);

    expect(project.provide).toHaveBeenCalledWith(
      'postgresUrl',
      'postgres://u:p@localhost:5/db',
    );
    expect(stop).not.toHaveBeenCalled();
    expect(teardown).toBeTypeOf('function');
    await (teardown as () => Promise<void>)();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
