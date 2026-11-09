import { isFigmaHost, isWorkUrl, isLoginUrl, isHomeUrl } from './urls.js';

// Firefox has promise-based `browser.*`; Chrome only has `chrome.*`.
const api = globalThis.browser ?? chrome;

const DEBUG = false;
const PENDING_TTL_MS = 15 * 60 * 1000;
const GLOBAL_KEY = 'global';

function log(...args) {
  if (DEBUG) console.log('[FigmaReturn]', ...args);
}

function logError(...args) {
  console.log('[FigmaReturn] ERROR', ...args);
}

// ---------- storage (storage.session) ----------

const tabKey = (tabId) => `tab:${tabId}`;
const emptyState = () => ({ lastWorkUrl: null, pendingSince: null });

async function getState(key) {
  const result = await api.storage.session.get(key);
  return { ...emptyState(), ...(result[key] || {}) };
}

async function setStates(entries) {
  await api.storage.session.set(entries);
}

function isFresh(state, now) {
  return (
    !!state.lastWorkUrl &&
    typeof state.pendingSince === 'number' &&
    now - state.pendingSince >= 0 &&
    now - state.pendingSince <= PENDING_TTL_MS
  );
}

// ---------- serialization ----------
// onUpdated can fire several times in quick succession for the same tab
// (changeInfo.url, then status "complete"). Run handlers one at a time so two
// events can't both read "pending" and both redirect. This is only a lock;
// all state lives in storage.

let queue = Promise.resolve();

function enqueue(fn) {
  queue = queue.then(fn).catch((err) => logError(err));
  return queue;
}

// ---------- core logic ----------

async function handleUrl(tabId, url) {
  if (!isFigmaHost(url)) {
    // e.g. accounts.google.com during SSO: keep pending state as-is.
    return;
  }

  const tKey = tabKey(tabId);
  const [tabState, globalState] = await Promise.all([getState(tKey), getState(GLOBAL_KEY)]);

  if (isWorkUrl(url)) {
    const wasPending = tabState.pendingSince !== null;
    const updates = {
      [tKey]: { lastWorkUrl: url, pendingSince: null },
      // If this tab was mid-login and landed on a design by itself, the
      // global fallback is no longer needed either.
      [GLOBAL_KEY]: { lastWorkUrl: url, pendingSince: wasPending ? null : globalState.pendingSince },
    };
    await setStates(updates);
    log(`tab ${tabId}: saved work URL`, url, wasPending ? '(cleared pending)' : '');
    return;
  }

  if (isLoginUrl(url)) {
    const now = Date.now();
    const updates = {};
    if (tabState.lastWorkUrl) updates[tKey] = { ...tabState, pendingSince: now };
    if (globalState.lastWorkUrl) updates[GLOBAL_KEY] = { ...globalState, pendingSince: now };
    if (Object.keys(updates).length) {
      await setStates(updates);
      log(`tab ${tabId}: login page, pending return to`, tabState.lastWorkUrl || globalState.lastWorkUrl);
    } else {
      log(`tab ${tabId}: login page, nothing saved to return to`);
    }
    return;
  }

  if (isHomeUrl(url)) {
    const now = Date.now();
    let savedUrl = null;
    let source = null;
    if (isFresh(tabState, now)) {
      savedUrl = tabState.lastWorkUrl;
      source = 'tab';
    } else if (isFresh(globalState, now)) {
      savedUrl = globalState.lastWorkUrl;
      source = 'global';
    }

    if (!savedUrl) return;

    // Clear pending FIRST so a failed or repeated navigation can't loop.
    await setStates({
      [tKey]: { ...tabState, pendingSince: null },
      [GLOBAL_KEY]: { ...globalState, pendingSince: null },
    });

    if (savedUrl === url || !isWorkUrl(savedUrl)) {
      log(`tab ${tabId}: skip redirect (same URL or not a work URL)`, savedUrl);
      return;
    }

    log(`tab ${tabId}: home after login, returning (${source}) to`, savedUrl);
    await api.tabs.update(tabId, { url: savedUrl });
  }
}

// ---------- listeners ----------

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    let url = changeInfo.url;
    if (!url && changeInfo.status === 'complete') url = tab && tab.url;
    if (!url) return;
    enqueue(() => handleUrl(tabId, url));
  } catch (err) {
    logError('onUpdated', err);
  }
});

api.tabs.onRemoved.addListener((tabId) => {
  enqueue(async () => {
    await api.storage.session.remove(tabKey(tabId));
    log(`tab ${tabId}: removed, state deleted`);
  });
});

// Chrome can swap a tab for a prerendered one; carry its state over.
api.tabs.onReplaced?.addListener((addedTabId, removedTabId) => {
  enqueue(async () => {
    const oldKey = tabKey(removedTabId);
    const result = await api.storage.session.get(oldKey);
    if (result[oldKey]) {
      await api.storage.session.set({ [tabKey(addedTabId)]: result[oldKey] });
    }
    await api.storage.session.remove(oldKey);
    log(`tab ${removedTabId} replaced by ${addedTabId}`);
  });
});

log('background started');
