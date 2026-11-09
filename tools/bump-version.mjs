// Bumps the version in manifest.json and prints the new version.
// Usage: node tools/bump-version.mjs patch|minor|major
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export function bumpVersion(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`version must look like 1.2.3, got: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  switch (kind) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      throw new Error(`bump must be patch, minor or major, got: ${kind}`);
  }
}

const VERSION_LINE = /("version"\s*:\s*")([^"]*)(")/;

function main() {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'manifest.json');
  const text = readFileSync(file, 'utf8');
  const next = bumpVersion(JSON.parse(text).version, process.argv[2]);
  // Replace only the version string so the rest of the formatting stays as it is.
  writeFileSync(file, text.replace(VERSION_LINE, `$1${next}$3`));
  console.log(next);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
