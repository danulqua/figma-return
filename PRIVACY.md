# Privacy Policy: Figma Return

Last updated: November 9, 2026

Figma Return does not collect, send or share any data.

## What the extension stores

To take you back to your design after you log in to Figma again, the extension keeps:

- the last Figma design URL each tab was on, and the last design URL overall
- a timestamp that marks a tab as "waiting to return" while you log in

This is stored only on your device, in the browser's session storage (`storage.session`). The browser clears it when it closes. The extension only reads URLs on `figma.com`. Other sites you visit are ignored and never stored.

## What the extension does not do

- It doesn't send anything to a server. It has no server.
- It doesn't use analytics, tracking or ads.
- It doesn't read page content, passwords or cookies.

## Permissions

- `tabs`: read the current tab's URL to detect the Figma login page and send the tab back to your design.
- `storage`: remember the last design URL until the browser closes.
- Host access to `figma.com` only.

## Contact

Questions: open an issue at https://github.com/danulqua/figma-return/issues
