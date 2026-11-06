# Night Cipher v6 — modular edition

A vanilla JavaScript cipher-puzzle game built with ES modules and Vite.

## Stack

- Vanilla JavaScript (ES modules)
- Vite for local development and production builds
- Browser LocalStorage for local progress (`nc`)
- Pollinations API integration with browser-side BYOP

## Run locally

Requires Node.js 20.19+ (or 22.12+).

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

Do not open `index.html` directly with `file://`; run it through Vite.

## Pollinations setup

Configure the Pollinations App Key in the `<polli-connect>` element in `index.html` and in `APP_KEY` in `js/app.js`. Use the same key in both places and register the served application URL as a Redirect URI. No server-side key storage is introduced.

## Data

Progress is stored locally in the browser under the `nc` LocalStorage key. It is device/browser-local and user-editable.

## Project structure

```text
index.html
styles.css
js/
  app.js
  state.js
  api.js
  ciphers.js
  security.js
  selftest.js
```

The self-test module is included as a regression-test foundation; the current UI does not automatically launch it from a query parameter.

## Current scope

The UI currently includes training levels, a daily cipher, AI-vs-human hiding, and a user-created cipher challenge. The modular split keeps API transport, state/progression, cipher definitions, and SVG security logic separate.
