import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromeManifest, firefoxManifest } from '../tools/build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

test('Chrome manifest has no Firefox-only keys', () => {
  const chrome = chromeManifest(manifest);
  assert.equal(chrome.browser_specific_settings, undefined);
  assert.equal(chrome.background.scripts, undefined);
  assert.equal(chrome.background.service_worker, 'background.js');
});

test('Firefox manifest has no service_worker', () => {
  const firefox = firefoxManifest(manifest);
  assert.equal(firefox.background.service_worker, undefined);
  assert.deepEqual(firefox.background.scripts, ['background.js']);
  assert.ok(firefox.browser_specific_settings.gecko.id);
});

test('building does not change the shared manifest', () => {
  const before = structuredClone(manifest);
  chromeManifest(manifest);
  firefoxManifest(manifest);
  assert.deepEqual(manifest, before);
});
