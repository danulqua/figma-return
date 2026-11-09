import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

test('background works in both Chrome and Firefox', () => {
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(manifest.background.scripts?.[0], 'background.js');
});

test('Firefox add-on ID is set', () => {
  assert.ok(manifest.browser_specific_settings?.gecko?.id);
});

test('every referenced file exists', () => {
  const files = [
    manifest.background.service_worker,
    ...manifest.background.scripts,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const file of files) {
    assert.ok(existsSync(join(root, file)), `missing file: ${file}`);
  }
});

test('version is x.y.z (both stores accept it, and tools/bump-version.mjs expects it)', () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
});
