// Derived from openspec/changes/move-api-deploys-to-staging-with-promotion/specs/api-delivery/spec.md
// ("A delivery fails unless the public health report names the delivered
// commit") before implementation, against the interface design decision 7
// names: awaitVersion({ url, expected, attempts, intervalMs, timeoutMs, fetch,
// sleep }). Provenance of each assertion is recorded in that change's
// test-plan.md.
import { describe, expect, it, vi } from 'vitest';

import { awaitVersion } from './await-version.ts';

const URL_ = 'https://basis-api.main-staging.example.org/health';
const EXPECTED = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'fedcba9876543210fedcba9876543210fedcba98';
const ATTEMPTS = 4;
const INTERVAL_MS = 10_000;

type Answer = { status: number; version?: string } | 'no answer';

const health = ({ status, version }: { status: number; version?: string }) =>
  new Response(JSON.stringify({ status: 'ok', version }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// A fake `fetch` answering each attempt in turn; the last answer repeats.
const fakeFetch = (answers: Answer[]) => {
  let call = 0;
  return vi.fn(async (_input: unknown, _init?: unknown) => {
    const answer = answers[Math.min(call, answers.length - 1)] as Answer;
    call += 1;
    if (answer === 'no answer') throw new TypeError('fetch failed');
    return health(answer);
  });
};

const wait = (fetch: ReturnType<typeof fakeFetch>) => {
  const sleep = vi.fn(async (_ms: number) => undefined);
  const result = awaitVersion({
    url: URL_,
    expected: EXPECTED,
    attempts: ATTEMPTS,
    intervalMs: INTERVAL_MS,
    timeoutMs: 5_000,
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep,
  });
  return { result, sleep };
};

const reasonOf = (result: unknown) =>
  (result as { reason?: string }).reason ?? '';

describe('the report names the commit', () => {
  it('succeeds', async () => {
    const fetch = fakeFetch([{ status: 200, version: EXPECTED }]);
    const { result } = wait(fetch);
    expect(await result).toEqual({ ok: true });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(URL_);
  });
});

describe('the report names another commit throughout', () => {
  it('fails naming the version reported and the one expected', async () => {
    const fetch = fakeFetch([{ status: 200, version: OTHER }]);
    const { result, sleep } = wait(fetch);
    const outcome = await result;
    expect(outcome).toMatchObject({ ok: false });
    expect(reasonOf(outcome)).toContain(OTHER);
    expect(reasonOf(outcome)).toContain(EXPECTED);
    expect(fetch).toHaveBeenCalledTimes(ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(ATTEMPTS - 1);
    for (const [ms] of sleep.mock.calls) expect(ms).toBe(INTERVAL_MS);
  });
});

describe('the report never answers', () => {
  it.each<[string, Answer]>([
    ['does not answer', 'no answer'],
    ['answers 503', { status: 503, version: EXPECTED }],
    ['answers 404', { status: 404 }],
  ])('fails saying it did not answer when it %s', async (_name, answer) => {
    const fetch = fakeFetch([answer]);
    const { result } = wait(fetch);
    const outcome = await result;
    expect(outcome).toMatchObject({ ok: false });
    expect(reasonOf(outcome)).toMatch(/did not answer/i);
    expect(fetch).toHaveBeenCalledTimes(ATTEMPTS);
  });
});

describe('a late answer', () => {
  it('succeeds once the commit is reported within the window', async () => {
    const fetch = fakeFetch([
      { status: 200, version: OTHER },
      { status: 200, version: EXPECTED },
    ]);
    const { result } = wait(fetch);
    expect(await result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
