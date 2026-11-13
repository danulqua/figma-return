// Submits a zip to addons.mozilla.org as a new listed version.
// Usage: node tools/publish-firefox.mjs dist/figma-return-firefox-1.2.3.zip
//
// Env:
//   AMO_API_KEY, AMO_API_SECRET   JWT issuer and secret from the AMO Developer Hub
//
// Doesn't wait for Mozilla's review.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_EXT = 'web-ext@10.8.0';

function fail(message) {
  console.error(`Firefox Add-ons: ${message}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

function run(command, args, env = process.env) {
  const { status } = spawnSync(command, args, { stdio: 'inherit', env });
  if (status !== 0) fail(`${command} exited with code ${status}`);
}

const zip = process.argv[2];
if (!zip) fail('usage: node tools/publish-firefox.mjs <path-to-firefox-zip>');

const env = {
  ...process.env,
  WEB_EXT_API_KEY: requireEnv('AMO_API_KEY'),
  WEB_EXT_API_SECRET: requireEnv('AMO_API_SECRET'),
};

const work = mkdtempSync(join(tmpdir(), 'figma-return-firefox-'));
try {
  const source = join(work, 'source');
  run('unzip', ['-q', zip, '-d', source]);
  run(
    'npx',
    [
      '--yes', WEB_EXT, 'sign',
      '--channel=listed',
      // Submit and exit; don't wait for Mozilla's review.
      '--approval-timeout=0',
      '--source-dir', source,
      '--artifacts-dir', join(work, 'artifacts'),
    ],
    env,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
