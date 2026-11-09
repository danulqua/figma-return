// Firefox has promise-based `browser.*`; Chrome only has `chrome.*`.
const api = globalThis.browser ?? chrome;

(async function () {
  const urlEl = document.getElementById('url');
  const button = document.getElementById('go');

  let lastWorkUrl = null;
  try {
    const { global } = await api.storage.session.get('global');
    lastWorkUrl = global && global.lastWorkUrl;
  } catch (err) {
    console.log('[FigmaReturn] popup: failed to read storage', err);
  }

  if (!lastWorkUrl) return;

  urlEl.textContent = lastWorkUrl.replace(/^https?:\/\/(www\.)?/, '');
  urlEl.title = lastWorkUrl;
  urlEl.classList.remove('empty');
  button.disabled = false;

  button.addEventListener('click', async () => {
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id !== undefined) {
        await api.tabs.update(tab.id, { url: lastWorkUrl });
      } else {
        await api.tabs.create({ url: lastWorkUrl });
      }
    } catch (err) {
      console.log('[FigmaReturn] popup: failed to open URL', err);
    }
    window.close();
  });
})();
