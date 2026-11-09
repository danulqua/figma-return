// Builds one store zip per browser into dist/:
//   dist/figma-return-chrome-<version>.zip   (no Firefox-only keys)
//   dist/figma-return-firefox-<version>.zip  (no service_worker)
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Runtime files only. manifest.json is written separately for each browser.
export const FILES = ['background.js', 'urls.js', 'popup.html', 'popup.js', 'icons'];

export function chromeManifest(manifest) {
  const { browser_specific_settings, ...rest } = structuredClone(manifest);
  delete rest.background.scripts;
  return rest;
}

export function firefoxManifest(manifest) {
  const result = structuredClone(manifest);
  delete result.background.service_worker;
  return result;
}

function build(browser, manifest) {
  const stage = join(dist, browser);
  mkdirSync(stage, { recursive: true });
  writeFileSync(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const file of FILES) cpSync(join(root, file), join(stage, file), { recursive: true });

  const zip = join(dist, `figma-return-${browser}-${manifest.version}.zip`);
  // -X drops extra file attributes; run inside the stage dir so manifest.json is at the zip root.
  execFileSync('zip', ['-r', '-X', '-q', zip, '.', '-x', '*.DS_Store'], { cwd: stage });
  return zip;
}

function main() {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  rmSync(dist, { recursive: true, force: true });
  console.log(build('chrome', chromeManifest(manifest)));
  console.log(build('firefox', firefoxManifest(manifest)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
