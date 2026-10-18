// Waits for the public health report to name the delivered commit
// (move-api-deploys-to-staging-with-promotion design decision 6), and fails
// otherwise: staging's record of success is what a promotion trusts, so a
// deploy not observably running its commit must not record one.
//
// It runs as `node tools/delivery/src/await-version.ts`, so it imports Node
// built-ins only and uses erasable syntax only.

export type WaitResult = { ok: true } | { ok: false; reason: string };

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const awaitVersion = async ({
  url,
  expected,
  attempts,
  intervalMs,
  timeoutMs,
  fetch = globalThis.fetch,
  sleep = pause,
}: {
  url: string;
  expected: string;
  attempts: number;
  intervalMs: number;
  timeoutMs: number;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<unknown>;
}): Promise<WaitResult> => {
  let reported: string | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 200) {
        const body: unknown = await response.json();
        const version =
          typeof body === 'object' && body !== null
            ? (body as Record<string, unknown>)['version']
            : undefined;
        if (version === expected) return { ok: true };
        reported = String(version);
      }
    } catch {
      // No answer, or an answer that is not JSON: try again.
    }
    // No sleep after the last attempt.
    if (attempt < attempts) await sleep(intervalMs);
  }
  return {
    ok: false,
    reason:
      reported === undefined
        ? `${url} did not answer with status 200 after ${attempts} attempts.`
        : `${url} reports version '${reported}', not ${expected}.`,
  };
};

if (import.meta.main) {
  const expected = process.env['EXPECTED_VERSION'] ?? '';
  const url = process.env['URL'] ?? '';
  const result = await awaitVersion({
    url,
    expected,
    attempts: Number(process.env['POLL_ATTEMPTS'] || 18),
    intervalMs: Number(process.env['POLL_INTERVAL'] || 10) * 1000,
    timeoutMs: 5000,
  });
  if (!result.ok) {
    console.log(`::error::${result.reason}`);
    process.exit(1);
  }
  console.log(`${url} reports version ${expected}.`);
}
