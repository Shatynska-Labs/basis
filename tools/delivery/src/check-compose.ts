// Checks what Compose resolves from deploy/api/docker-compose.yml and the
// rendered `.env` before anything is delivered (move-api-deploys-to-staging-
// with-promotion design decision 7): the service `api`, and every other
// service declared, must run the rendered digest, and `api` must carry the
// rendered router rule, so a rule or image corrupted between rendering and
// Compose never reaches the host. A configuration without `migrate`, as every
// commit before migrations were delivered has, passes, so that such a commit
// stays promotable (add-persistence-skeleton design decision 7). A refusal names the
// field and never a value: Compose inlines the rendered `.env` into its output.
//
// It runs as `node tools/delivery/src/check-compose.ts`, so it imports Node
// built-ins only and uses erasable syntax only.

import { readFileSync } from 'node:fs';

const IMAGE_NAME = 'ghcr.io/shatynska-labs/basis-api';
const RULE_LABEL = 'traefik.http.routers.basis-api.rule';

export type CheckResult = { ok: true } | { ok: false; reason: string };

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;

export const checkCompose = ({
  config,
  routerRule,
  imageDigest,
}: {
  config: unknown;
  routerRule: string;
  imageDigest: string;
}): CheckResult => {
  const services = field(config, 'services');
  const service = field(services, 'api');
  const others =
    typeof services === 'object' && services !== null
      ? Object.keys(services).filter((name) => name !== 'api')
      : [];
  // `api` first, so its failure is the one named when both differ.
  for (const name of ['api', ...others]) {
    if (
      field(field(services, name), 'image') !== `${IMAGE_NAME}@${imageDigest}`
    ) {
      return {
        ok: false,
        reason: `the service ${name}'s resolved image is not ${IMAGE_NAME} at the rendered IMAGE_DIGEST.`,
      };
    }
  }
  if (field(field(service, 'labels'), RULE_LABEL) !== routerRule) {
    return {
      ok: false,
      reason: `the service api's resolved router rule (${RULE_LABEL}) is not the rendered ROUTER_RULE.`,
    };
  }
  return { ok: true };
};

if (import.meta.main) {
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    console.log(
      '::error::The Compose configuration on standard input is not JSON.',
    );
    process.exit(1);
  }
  const result = checkCompose({
    config,
    routerRule: process.env['ROUTER_RULE'] ?? '',
    imageDigest: process.env['IMAGE_DIGEST'] ?? '',
  });
  if (!result.ok) {
    console.log(`::error::${result.reason} Nothing was delivered.`);
    process.exit(1);
  }
  console.log('Compose resolves the rendered image and router rule.');
}
