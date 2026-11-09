// Pure URL helpers. No chrome.* APIs here so this file can be tested in Node.
// Every function returns false (never throws) for empty or invalid input.

const FIGMA_HOSTS = new Set(['figma.com', 'www.figma.com']);

// Pages where the user is actually working on something.
const WORK_PREFIXES = [
  '/design/',
  '/file/',
  '/board/',
  '/proto/',
  '/slides/',
  '/site/',
  '/make/',
  '/deck/',
];

// First path segment of auth-related pages. Matched as a prefix of the
// segment, so "login" also covers "/login_sso", "/login/verify", etc.
const LOGIN_SEGMENT_PREFIXES = [
  'login',
  'signin',
  'sign_in',
  'sign-in',
  'signup',
  'sign_up',
  'sign-up',
  'logout',
  'log_out',
  'logged_out',
  'sso',
  'saml',
  'auth',
  'oauth',
  'reset_password',
  'forgot_password',
  'password_reset',
  'two_factor',
  'mfa',
  'verify',
];

function parse(url) {
  if (typeof url !== 'string' || url === '') return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u;
  } catch {
    return null;
  }
}

function figmaUrl(url) {
  const u = parse(url);
  return u && FIGMA_HOSTS.has(u.hostname) ? u : null;
}

export function isFigmaHost(url) {
  return figmaUrl(url) !== null;
}

export function isWorkUrl(url) {
  const u = figmaUrl(url);
  if (!u) return false;
  return WORK_PREFIXES.some((p) => u.pathname.startsWith(p));
}

export function isLoginUrl(url) {
  const u = figmaUrl(url);
  if (!u) return false;
  const firstSegment = u.pathname.split('/')[1]?.toLowerCase() ?? '';
  if (!firstSegment) return false;
  return LOGIN_SEGMENT_PREFIXES.some((p) => firstSegment.startsWith(p));
}

export function isHomeUrl(url) {
  const u = figmaUrl(url);
  if (!u) return false;
  const p = u.pathname;
  return p === '/' || p === '/files' || p.startsWith('/files/');
}
