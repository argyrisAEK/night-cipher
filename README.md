# Night Cipher v6 — modular edition

A vanilla JavaScript cipher-puzzle game refactored into ES modules. The original v5 single-file application is preserved as `Night-Cipher-v5-reference.html`.

## Stack

- Vanilla JavaScript (ES modules)
- Vite for local development and production builds
- Browser LocalStorage for local progress
- Pollinations API integration with browser-side BYOP flow

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

## Regression tests

Run the app through Vite and open `/?selftest`. The in-browser test suite includes a mocked transport test and does not make a live Pollinations API request.

## Data compatibility

The application retains the `nc` LocalStorage key and merges existing v5 state with defaults. Progress remains local to the browser profile and is user-editable.

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
Night-Cipher-v5-reference.html
```

See the source files for implementation details and known limitations.
