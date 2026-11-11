# Night Cipher

> A visual steganography puzzle game where two AI models compete: one hides a secret inside an ordinary-looking scene, the other tries to decode it — blind.

[![Live](https://img.shields.io/badge/live-night--cipher.vercel.app-amber)](https://night-cipher.vercel.app/)
[![Pollinations](https://img.shields.io/badge/powered%20by-Pollinations-8a7dff)](https://pollinations.ai/)

---

## What it is

Night Cipher is a browser puzzle game built around **information asymmetry**. A **Seer** (AI Hider) embeds a message into the visual structure of an SVG scene. A **Seeker** (AI vision model) receives only the rendered image — no secret, no scheme, no hints — and tries to recover the message.

You, the player, are the referee. You choose the secret, watch the AI compete, and can inspect every step: the raw SVG, the Hider's private explanation, the Seeker's prompt, the blind-payload audit, and the exact recovery rate per model.

The game also includes ten hand-built deterministic ciphers, a daily puzzle shared across timezones, and a full research mode for evaluating Hider/Seeker performance.

**Live:** https://night-cipher.vercel.app/

---

## Game modes

| Mode | Cost | What it does |
|---|---|---|
| 📅 **Daily** | free | One puzzle per day, deterministic across your timezone. 3 tries, optional hints. Modifier ("No-Hint Protocol") rotates. |
| 🎓 **Learn** | free | Ten training levels, one per visual cipher. Hints available. Progress and best times saved locally. |
| ⚔ **AI vs AI Duel** | 💰 Pollen | You pick a secret. The AI Hider creates an SVG that conceals it. The AI Seeker then tries to decode it blind. Retry allowed on failure. |
| 🕵 **You hide, AI seeks** | 💰 Pollen | You pick a word and one of the ten known ciphers. The AI Seeker tries to recover it. Useful for calibrating model vision. |
| 🧬 **Interactive Sandbox** | free | Pixel-level LSB editor and live structural cipher encoder. No AI calls. |
| 🧭 **Cipher Walkthrough** | free | Step-by-step guide through all ten training ciphers. |
| 🧪 **Image Degradation Lab** | 💰 Pollen | Same SVG, five degradation variants (blur, JPEG, noise, downscale, posterize). Measures Seeker robustness. 5 additional requests. |
| 🧪 **Research** | 💰 Pollen | Round-level diagnostics, model leaderboard, matchup matrix, evidence log with CSV/JSON export. |

💰 = uses Pollinations Pollen from your own account (see [BYOP](#byop-bring-your-own-pollen)).

---

## The ten visual ciphers

Every cipher has a matching decoder used by the reveal view and the self-test. Encoding and decoding are inverse operations on the full A–Z domain.

| # | Name | Visual rule | Decode |
|---|---|---|---|
| 1 | **Skyline** | One building per letter. Roof height = alphabet position × 12 px + 10. | Height → letter |
| 2 | **Morse stars** | Short stars = dots, long = dashes, wide gaps = letter breaks. | Morse → letter |
| 3 | **Compass** | One dial per letter. Needle angle = (position − 1) × 360/26° from the red tick. | Angle → letter |
| 4 | **Windows** | One building per letter. Five windows = 5-bit binary, lit = 1, top to bottom. | Binary → letter |
| 5 | **Braille** | Each 2×3 cell is one letter. Gold dots are raised, numbered 1–6 down-left then up-right. | Braille → letter |
| 6 | **Colour** | One balloon per letter. Hue = position on a 26-step hue wheel; a swatch key runs A–Z at the top. | Hue → letter |
| 7 | **Constellation** | One framed cluster per letter. Count the gold dots. | Count → letter |
| 8 | **Facets** | One polygon per letter. Number of sides − 2 = alphabet position (triangle = A). | Sides → letter |
| 9 | **Bloom** | One flower per letter. Count the petals; one petal = A. | Petals → letter |
| 10 | **Rhythm** | Five vertical bars per letter. Tall = 1, short = 0, left to right. | Binary → letter |

The AI-vs-AI duel does **not** use any of these — the Hider invents its own organic encoding and explains it privately in a `SCHEME:` line that is never shown to the Seeker.

---

## BYOP (Bring Your Own Pollen)

The app ships with no server-side API route and no server-held secret. All AI calls run from your browser against `https://gen.pollinations.ai/v1/chat/completions` using **your own** Pollinations API key.

1. Click **Connect** (top right) and authorize with your Pollinations account.
2. The App Key `pk_...` in the source is a **public OAuth client identifier**, not a secret.
3. Your `sk_` key is stored only in browser memory for the session. Do not commit an `sk_` key to any repo.
4. Every AI request is metered against your Pollen balance. Free modes (Daily, Learn, Sandbox, Walkthrough) cost nothing.

Models are selected from a fixed allowlist in `js/models.js`. Vision-capable models are required for Seeker roles; the UI filters accordingly.

---

## Security & trust model

The game makes four guarantees. Each is enforced by code, not by convention.

### 1. The Seeker never sees the secret or the scheme
`auditBlindRequest()` runs immediately before dispatch. It normalizes the prompt and verifies:
- the secret is not present as a substring (single common words like "THE" are whitelisted to avoid false positives),
- the `SCHEME:` explanation is **excluded** in blind modes and **included** in guided modes,
- an image is actually attached.

If the audit fails, the request is not sent.

### 2. AI-authored SVG is sanitized with an allowlist
`clean()` parses the SVG with `DOMParser`, rejects foreign namespaces, and keeps only:
- an explicit element allowlist (`svg`, shapes, gradients, filters, `use`, `clipPath`, `mask`),
- an explicit attribute allowlist,
- a style-property allowlist with guards against `javascript:`, `data:`, `expression()`, `var()`, `@import`, and non-local `url()`,
- `href` only on `<use>` and only as `#id` references,
- comments, `<script>`, `<foreignObject>`, `<image>`, `<metadata>`, `<title>`, `<desc>`, and stray text nodes are removed,
- `viewBox` and dimension limits are enforced,
- element count (≤ 2500) and attribute size (≤ 10 000) are capped.

### 3. Literal secret leakage is checked **before** sanitization
`hasSecretLeak()` inspects the raw model output — text content, **all** attributes, and comments — for the exact phrase and for URL-encoded, base64, and hex variants. Running this before `clean()` matters because `clean()` strips metadata and comments that could otherwise hide the secret.

### 4. Every round is inspectable
The Research tab exposes the full diagnostic JSON: Hider prompt, raw response, sanitized SVG, validation results, Seeker prompt, blind audit, usage, tokens, estimated Pollen cost, and independent-seeker agreement. Nothing is hidden from the player.

**Known limits:** see [Limitations](#limitations).

---

## Research mode

Research mode turns every round into a data point. It is designed to answer one question: *given this Hider, this Seeker, and this image encoding, what is the honest recovery rate?*

- **Model leaderboard** — per-model exact recovery, primary and independent, average tokens and duration.
- **Matchup matrix** — Hider → Seeker pair win rates.
- **Quality & independent validation** — agreement and dual-model exact recovery. A second vision model is sent the same blind prompt and image; agreement between two independent models is stronger evidence than a single hit.
- **Stealth ratings** — a judge model rates how innocuous each image looks on a 1–10 scale with a one-sentence justification.
- **Robustness** — same SVG, three image encodings (PNG, JPEG 85 %, JPEG 55 %). Reports recovery rate and mean similarity.
- **Evidence log** — last 200 events, filterable by type / outcome / model / text, exportable as CSV or JSON. Everything is stored in `localStorage` under the `nc` key, on your device only.

The **Image Degradation Lab** is the more aggressive sibling: five deterministic variants (blur, JPEG, noise, downscale, posterize) generated in-browser with `createDegradationVariants()`. The blind audit runs once before the batch; if it fails, no image is sent.

---

## Privacy & data

- **No account system.** Nothing is sent to a Night Cipher server — there isn't one.
- **All state is local.** Progress, best times, daily wins, evidence log, and preferences live in `localStorage['nc']`. Clearing browser data resets the game.
- **No analytics.** No third-party scripts, no trackers, no fonts loaded from CDNs.
- **AI requests go directly to Pollinations** with your own key. Night Cipher does not see, log, or relay them.
- **Diagnostics stay in your browser.** "Copy diagnostic JSON" is a manual clipboard action; nothing is uploaded.

---

## Limitations

Night Cipher is honest about what it does **not** prove.

- **AI behavior is non-deterministic.** The same puzzle can be solved on one run and missed on the next. Scores are not a measure of model "intelligence", only of one attempt under one prompt.
- **Blind audits are local.** They verify what *we* send, not what a remote provider does internally.
- **Literal-leak checks cannot catch semantic leaks.** If the secret is `APPLE` and the image draws a red apple, `hasSecretLeak()` returns `false`. That is a real limitation of string-based detection.
- **Sanitization is necessary, not sufficient.** The allowlist is strict, but no sanitizer is provably perfect. Do not feed Night Cipher untrusted third-party SVGs.
- **Mocked tests cannot establish live model reliability.** Unit tests exercise the cipher encode/decode round trip and the sanitizer; they do not certify any model.
- **Pollen costs are estimates.** `estimatePollenCost()` uses published rates and observed token counts; the provider's billing is authoritative.

---

## Development

```bash
git clone https://github.com/argyrisAEK/night-cipher.git
cd night-cipher
npm install
npm run dev
