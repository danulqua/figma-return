// Uploads a zip to the Chrome Web Store (API v2) and submits it for publishing.
// Usage: node tools/publish-chrome.mjs dist/figma-return-chrome-1.2.3.zip
//
// Env:
//   CWS_PUBLISHER_ID, CWS_EXTENSION_ID   required
//   CWS_SERVICE_ACCOUNT_KEY              service account JSON key (used in CI), or
//   CWS_ACCESS_TOKEN                     an access token you already have, e.g. from gcloud
//
// API reference: https://developer.chrome.com/docs/webstore/api/reference/rest
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const API = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const POLL_INTERVAL_MS = 5_000;
const POLL_LIMIT_MS = 5 * 60_000;

function fail(message) {
  console.error(`Chrome Web Store: ${message}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

const base64url = (data) => Buffer.from(data).toString('base64url');

// Service account JWT flow: https://developers.google.com/identity/protocols/oauth2/service-account
async function accessTokenFromKey(keyJson) {
  let key;
  try {
    key = JSON.parse(keyJson);
  } catch {
    fail('CWS_SERVICE_ACCOUNT_KEY is not valid JSON');
  }
  const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) fail(`could not get an access token (${res.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

async function call(token, method, url, { body, contentType } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(contentType && { 'Content-Type': contentType }) },
    body,
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${url} failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) fail('usage: node tools/publish-chrome.mjs <zip>');
  const publisher = requireEnv('CWS_PUBLISHER_ID');
  const item = requireEnv('CWS_EXTENSION_ID');
  const token =
    process.env.CWS_ACCESS_TOKEN || (await accessTokenFromKey(requireEnv('CWS_SERVICE_ACCOUNT_KEY')));
  const name = `publishers/${publisher}/items/${item}`;

  console.log(`Uploading ${zipPath}...`);
  const upload = await call(token, 'POST', `${API}/upload/v2/${name}:upload`, {
    body: readFileSync(zipPath),
    contentType: 'application/zip',
  });
  console.log('Upload response:', JSON.stringify(upload));

  // Large packages are processed asynchronously. The docs use both names for this state.
  let state = upload.uploadState;
  const deadline = Date.now() + POLL_LIMIT_MS;
  while (state === 'IN_PROGRESS' || state === 'UPLOAD_IN_PROGRESS') {
    if (Date.now() > deadline) fail('upload is still processing after 5 minutes');
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const status = await call(token, 'GET', `${API}/v2/${name}:fetchStatus`);
    state = status.lastAsyncUploadState;
    console.log('Upload state:', state);
  }
  if (state !== 'SUCCEEDED') fail(`upload did not succeed: ${JSON.stringify(upload)}`);

  console.log('Submitting for review and publishing...');
  const publish = await call(token, 'POST', `${API}/v2/${name}:publish`, {
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
    contentType: 'application/json',
  });
  console.log('Publish response:', JSON.stringify(publish));
  for (const warning of publish.warningInfo?.warnings ?? []) {
    console.log(`::warning title=Chrome Web Store::${warning.reason}: ${warning.description}`);
  }
  console.log(`Done. Submission state: ${publish.state}`);
}

main().catch((error) => fail(error.stack || String(error)));
