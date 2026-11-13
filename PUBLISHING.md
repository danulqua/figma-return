# Publishing

One-time setup for publishing Figma Return publicly on the Chrome Web Store and Firefox Add-ons (addons.mozilla.org, "AMO"), and how releases work after that.

Neither store has an API for creating a new listing, so the **first version goes in by hand**. After that, the **Release** workflow on GitHub uploads new versions to both stores.

Build the zips you upload by hand:

```sh
node tools/build.mjs
```

This writes `dist/figma-return-chrome-<version>.zip` and `dist/figma-return-firefox-<version>.zip`. Each one has a manifest made for its store.

Privacy policy link for both stores: `https://github.com/danulqua/figma-return/blob/main/PRIVACY.md`

## Chrome Web Store

### 1. First version (by hand)

1. Register as a developer at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). There is a one-time registration fee (it has been $5). The account needs 2-step verification turned on.
2. Click **Add new item** and upload `dist/figma-return-chrome-<version>.zip`.
3. **Store listing**:
   - Description, category (for example *Workflow & Planning* or *Tools*), language.
   - 128×128 icon: `icons/icon-128.png`.
   - At least one screenshot, 1280×800 (or 640×400).
   - A small promo tile (440×280) if the dashboard asks for one.
4. **Privacy**:
   - Single purpose: "Returns the Figma tab to the design you were on after Figma logs you out and you log back in."
   - Permission reasons:
     - `tabs`: read the tab URL to detect the Figma login page and send the tab back to the design.
     - `storage`: remember the last design URL until the browser closes.
     - Host permissions: only `figma.com`, to recognize Figma design, login and home pages.
   - Remote code: **No**.
   - Data usage: check nothing (no data collected), then confirm the three certifications.
   - Privacy policy URL: the link above.
5. **Distribution**: visibility **Public**, all regions.
6. Click **Submit for review**. Review usually takes from a few hours to a few days. If you choose to publish manually after review, the approved version waits as "staged" and has to be published within 30 days.

### 2. Automation (after the first version is live)

The Release workflow logs in with a Google Cloud **service account**.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (any name, for example `figma-return-publish`).
2. **APIs & Services → Library** → search **Chrome Web Store API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account**. Any name. It needs no Cloud roles.
4. Open the service account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads. Treat it like a password.
5. In the Chrome Web Store Developer Dashboard → **Settings → Service account**, add the service account's email (`...@....iam.gserviceaccount.com`). A publisher can have only one service account.
6. Find the IDs:
   - **Publisher ID**: in the Dashboard under **Settings**, and in the Dashboard URL after `/devconsole/`.
   - **Item ID**: the 32-letter extension ID on the item's page in the Dashboard.
7. Add GitHub secrets (repo **Settings → Secrets and variables → Actions → New repository secret**):

   | Secret | Value |
   | --- | --- |
   | `CWS_SERVICE_ACCOUNT_KEY` | the whole contents of the `.json` key file |
   | `CWS_PUBLISHER_ID` | publisher ID |
   | `CWS_EXTENSION_ID` | item ID |

   Then delete the downloaded key file.

To try the upload from your machine, fill in the Chrome values in `.env` (see [Local credentials](#local-credentials)) and run `node --env-file=.env tools/publish-chrome.mjs dist/figma-return-chrome-<version>.zip`. This submits a real version, and the store rejects a version number it already has.

## Firefox Add-ons (AMO)

### 1. First version (by hand)

1. Sign in at [addons.mozilla.org Developer Hub](https://addons.mozilla.org/developers/) with a Mozilla account (free).
2. **Submit a New Add-on** → **On this site** (listed) → upload `dist/figma-return-firefox-<version>.zip`.
3. When asked whether you need to submit source code (minified, bundled or generated code), answer **No**. The code is uploaded as written.
4. Fill in name, summary, description, categories, license (for example MIT), and the privacy policy (paste the text of `PRIVACY.md` or link it). Screenshots are optional but help.
5. Submit. Review is automated and sometimes also done by a person. Listed add-ons appear on AMO after approval.

The add-on ID `figma-return@danulqua` comes from `manifest.json`. Don't change it: AMO uses it to match new versions to this listing.

### 2. Automation

1. Developer Hub → **Tools → Manage API Keys** → generate credentials.
2. Add GitHub secrets:

   | Secret | Value |
   | --- | --- |
   | `AMO_API_KEY` | JWT issuer (looks like `user:12345:678`) |
   | `AMO_API_SECRET` | JWT secret |

To try the upload from your machine, fill in the Firefox values in `.env` (see [Local credentials](#local-credentials)) and run `node --env-file=.env tools/publish-firefox.mjs dist/figma-return-firefox-<version>.zip`. This submits a real version, and AMO rejects a version number it already has. Re-submitting the current version is a safe way to check the credentials: a "Version already exists" error means they work. To check the package without submitting, run `npx web-ext@10.8.0 lint --source-dir dist/firefox` (needs no credentials).

## Local credentials

The publish scripts read their credentials from environment variables. To keep them in a file:

```sh
cp .env.example .env
```

Fill in `.env`. It is git-ignored, so it is never committed. `CWS_SERVICE_ACCOUNT_KEY` has to be the JSON key on a single line in single quotes. `jq -c . key.json` prints it that way. After that you can delete the downloaded key file.

GitHub Actions doesn't use `.env`; it reads the same names from the repository secrets.

## Releasing a new version

1. Push your changes to `main` and wait for the **CI** workflow to pass.
2. On GitHub: **Actions → Release → Run workflow**, pick `patch` (fixes), `minor` (features) or `major`, and click **Run workflow**.

The workflow:

1. Runs the tests, bumps `version` in `manifest.json`, builds both zips and lints the Firefox one.
2. Commits `Release vX.Y.Z`, tags `vX.Y.Z`, pushes both to `main`, and creates a GitHub Release with both zips attached.
3. **chrome** job: uploads the Chrome zip and submits it for review. It goes live automatically after approval.
4. **firefox** job: submits the Firefox zip as a listed version. It doesn't wait for Mozilla's review.

Users get the new version through normal store updates.

Notes:

- A store job whose secrets aren't set finishes with a "skipped" notice instead of failing, so releases work before both stores are set up.
- If one store job fails (for example, a store outage), open the run and click **Re-run failed jobs**. It retries only that store with the same zips and doesn't bump the version again.
- Both stores reject a version number they already have, so every upload needs a new version. The Release workflow always bumps it.
- After running Release, run `git pull` locally to get the version bump commit.
