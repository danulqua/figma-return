# Figma Return

When Figma (in the browser) says *"You've been logged out. Your session ended. Please log back in."*, it sends you to the login page and then drops you on the files list. This extension remembers the exact design URL you were on, including `node-id` and other query params, and takes the tab back there after you log in.

It works in Chromium browsers (Chrome, Arc, Brave, Edge) and Firefox (140+).

## Install

Once published, install it from the Chrome Web Store or Firefox Add-ons (addons.mozilla.org). To run it from this folder instead (for development):

### Chrome, Edge, Brave, Arc

1. Open `chrome://extensions` (or `arc://extensions`, `brave://extensions`, `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder (the one with `manifest.json`).

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and pick `manifest.json` in this folder.

Firefox removes temporary add-ons when it restarts.

Or run `npx web-ext run --firefox=/Applications/Firefox.app/Contents/MacOS/firefox`: it opens a clean Firefox profile with the extension loaded and reloads it when files change.

## How it works

- While you work, every Figma design URL a tab visits (`/design/`, `/file/`, `/board/`, `/proto/`, `/slides/`, `/site/`, `/make/`, `/deck/`) is saved for that tab and as a global "last design". Figma changes the URL without reloading the page when you select things (`node-id`), and those changes are saved too.
- When a tab goes to a Figma login page (`/login`, `/signup`, `/sso`, ...), the extension marks it as "waiting to return".
- Non-Figma pages in between (for example Google SSO at `accounts.google.com`) are ignored, so the waiting mark is kept.
- When the tab then reaches Figma home (`/`, `/files`, `/files/...`) within 15 minutes, the extension clears the mark and sends the tab back to the saved design. If the login finished in a different tab, it uses the global last design instead.
- State is kept in `storage.session`, so it survives the background script going to sleep and is cleared when the browser closes.

**Popup fallback:** click the toolbar icon to see the last saved design and a **Return to last design** button that opens it in the current tab.

## Debugging

In Chrome:

1. Go to `chrome://extensions` and find **Figma Return**.
2. Click **service worker** (next to "Inspect views") to open DevTools for the background script.
3. In the Console, look for lines starting with `[FigmaReturn]`.

In Firefox:

1. Go to `about:debugging#/runtime/this-firefox` and find **Figma Return**.
2. Click **Inspect**.
3. In the Console, look for lines starting with `[FigmaReturn]`.

Logging is off in releases. To turn it on, set `const DEBUG = true` at the top of `background.js`. Errors are logged even when it's off.

To look at the saved state, run this in that console:

```js
// Chrome
chrome.storage.session.get(null).then(console.log)
// Firefox
browser.storage.session.get(null).then(console.log)
```

## Tests

Tests use Node's built-in test runner (Node 22+, no npm install). They cover the URL helpers in `urls.js`, check that `manifest.json` is valid for both browsers and that every file it references exists, and test the build and version tools:

```sh
node --test
```

To lint the Firefox build the way CI does:

```sh
node tools/build.mjs
npx web-ext lint --source-dir dist/firefox   # 1 warning is expected: Firefox for Android isn't targeted
```

GitHub Actions runs the tests, the build and the lint on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

## Releasing

Releases go to the Chrome Web Store and Firefox Add-ons from GitHub: **Actions → Release → Run workflow**, then pick `patch`, `minor` or `major`. The workflow bumps the version, tags it, creates a GitHub Release with both zips, and uploads to both stores.

The first version in each store goes in by hand, and the workflow needs store API keys as GitHub secrets. Both are described step by step in [PUBLISHING.md](PUBLISHING.md).

`node tools/build.mjs` builds the store zips locally into `dist/`: one for Chrome (no Firefox-only manifest keys) and one for Firefox (no `service_worker`). The `manifest.json` in this folder is shared by both browsers, so loading the folder directly keeps working.

## Files

- `manifest.json`: extension manifest (MV3), shared by Chrome and Firefox
- `background.js`: background script (service worker in Chrome, event page in Firefox) that tracks URLs and redirects after login
- `urls.js`: pure URL classification helpers
- `popup.html`, `popup.js`: fallback popup
- `icons/`: extension icons (16, 32, 48, 128 px PNGs)
- `test/`: tests for `urls.js`, `manifest.json`, the build and the version bump
- `tools/build.mjs`: builds the Chrome and Firefox store zips into `dist/`
- `tools/bump-version.mjs`: bumps `version` in `manifest.json` (`node tools/bump-version.mjs patch`)
- `tools/publish-chrome.mjs`: uploads a zip to the Chrome Web Store and submits it (used by the Release workflow)
- `tools/make-icons.mjs`: draws the icons; not used by the extension at runtime
- `.github/workflows/`: CI and Release workflows
- `PUBLISHING.md`: one-time store setup and how releases work
- `PRIVACY.md`: privacy policy linked from both store listings

To change the icon, edit the design constants in `tools/make-icons.mjs` and run `node tools/make-icons.mjs` (no npm install needed).
