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


## Development and verification

```bash
npm install
npm run dev
npm run build
npx playwright install chromium
npm test
```

The Playwright regression suite checks the game shell and BYOP vision scope, the Bloom petal-count encoding, guided versus blind seeker prompts, and backward compatibility with the existing `nc` LocalStorage record.

## Vercel

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Root directory: repository root

The application is static; no server-side API route is required.

## Pollinations BYOP

The App Key is a public OAuth client identifier, not an API credential. The user-authorized temporary secret key is read from `polli-connect.apiKey` and sent as a Bearer token.

The Connect widget requests the `text` model category. Vision-capable chat models are text models that advertise `image` in `input_modalities`; the app filters the catalog accordingly. The separate `image` category is for image-generation models and is not required for these chat-completion vision requests. Register the exact deployed URL (for example, `https://night-cipher.vercel.app/`) as a Redirect URI for the App Key.

Do not commit a user `sk_` key. The existing `nc` LocalStorage key and game progression schema are retained.
