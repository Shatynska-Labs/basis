// Renders the `.env` delivered beside deploy/api/docker-compose.yml
// (move-api-deploys-to-staging-with-promotion design decisions 2, 3 and 7):
// the image digest and the Traefik rule, built from the target's server and
// the base domain, so no hostname is written down anywhere. Every value goes
// through renderLine, the infrastructure repository's escaping rule, so one
// added later is escaped by construction.
//
// It runs as `node tools/delivery/src/render-env.ts`, so it imports Node
// built-ins only and uses erasable syntax only.

import { appendFileSync, writeFileSync } from 'node:fs';

const SERVICE = 'basis-api';

// A literal per target, never a variable: no settings edit can point one
// workflow at the other host's name.
const SERVERS: Readonly<Record<string, string>> = {
  staging: 'main-staging',
  production: 'main-production',
};

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

// Double-quoted, with `\` -> `\\`, then `"` -> `\"`, then `$` -> `$$`.
export const renderLine = (name: string, value: string): string =>
  `${name}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('$', '$$$$')}"`;

const isBaseDomain = (value: string): boolean => {
  const labels = value.split('.');
  return (
    value.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label))
  );
};

export const renderEnv = ({
  target,
  baseDomain,
  imageDigest,
}: {
  target: string;
  baseDomain: string;
  imageDigest: string;
}): { content: string; technicalHostname: string; routerRule: string } => {
  const server = Object.hasOwn(SERVERS, target) ? SERVERS[target] : undefined;
  if (server === undefined) {
    throw new Error(`The target '${target}' is not staging or production.`);
  }
  if (!isBaseDomain(baseDomain)) {
    throw new Error(
      `BASE_DOMAIN is not a lowercase hostname of two or more labels: '${baseDomain}'.`,
    );
  }
  if (!DIGEST.test(imageDigest)) {
    throw new Error(
      `IMAGE_DIGEST is not sha256: followed by 64 lowercase hexadecimal characters: '${imageDigest}'.`,
    );
  }
  const technicalHostname = `${SERVICE}.${server}.${baseDomain}`;
  // The one alias is production's, and follows the domain.
  const hosts =
    target === 'production'
      ? [technicalHostname, `api.basis.${baseDomain}`]
      : [technicalHostname];
  const routerRule = hosts.map((host) => `Host(\`${host}\`)`).join(' || ');
  return {
    content: `${[
      renderLine('IMAGE_DIGEST', imageDigest),
      renderLine('ROUTER_RULE', routerRule),
    ].join('\n')}\n`,
    technicalHostname,
    routerRule,
  };
};

if (import.meta.main) {
  const target = process.env['TARGET'] ?? '';
  let rendered: ReturnType<typeof renderEnv>;
  try {
    rendered = renderEnv({
      target,
      baseDomain: process.env['BASE_DOMAIN'] ?? '',
      imageDigest: process.env['IMAGE_DIGEST'] ?? '',
    });
  } catch (error) {
    console.log(`::error::${(error as Error).message} Nothing was written.`);
    process.exit(1);
  }
  writeFileSync(process.env['ENV_FILE'] ?? '.env', rendered.content, {
    mode: 0o600,
  });
  const output = process.env['GITHUB_OUTPUT'];
  if (output) {
    appendFileSync(
      output,
      `technical-hostname=${rendered.technicalHostname}\nrouter-rule=${rendered.routerRule}\n`,
    );
  }
}
