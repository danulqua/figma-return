import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bumpVersion } from '../tools/bump-version.mjs';

test('patch, minor and major bumps', () => {
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(bumpVersion('1.0.9', 'patch'), '1.0.10');
});

test('invalid version throws', () => {
  for (const version of ['1.2', '1.2.3.4', 'v1.2.3', '1.2.x', '', undefined]) {
    assert.throws(() => bumpVersion(version, 'patch'), /version/, String(version));
  }
});

test('unknown bump kind throws', () => {
  for (const kind of ['', 'Patch', 'build', undefined]) {
    assert.throws(() => bumpVersion('1.2.3', kind), /bump/, String(kind));
  }
});
