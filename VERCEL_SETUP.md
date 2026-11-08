# Night Cipher server-side Hider setup

The AI-vs-AI Hider now runs through Vercel Node functions. The browser receives only the finished SVG and an opaque encrypted round token; the encoding plan, symbol mapping and answer are kept inside the server-side function state.

## Required Vercel environment variable

Create a persistent 32-byte secret and add it to the Vercel project:

```bash
openssl rand -hex 32
```

Set the generated value as `NIGHT_CIPHER_ROUND_SECRET` in **Vercel → Project → Settings → Environment Variables**.

Add it to **Production, Preview and Development**. Keep the same value across deployments; changing it invalidates previously issued round tokens. Never commit this value to GitHub or expose it in frontend variables such as `VITE_*`.

## Pollinations BYOP handling

The user's Pollinations connection token is sent over HTTPS to `/api/hide` for that one generation and forwarded to Pollinations. It is not written to disk, localStorage, the encrypted round token, or application logs by this code. The browser continues to use its own BYOP connection for Seeker and optional stealth-judge requests.

## What is kept private

- The server selects the encoding and constructs the symbol layout.
- The AI Hider receives only a scene/art prompt. It does not receive the secret or the symbol mapping.
- The browser receives the rendered SVG and an AES-256-GCM encrypted reveal token.
- The Seeker receives only the rendered image and its blind cryptanalysis prompt.
- The reveal endpoint decrypts the plan only after the user explicitly requests “How was it hidden?”.

The SVG necessarily contains the visual evidence needed to solve the puzzle. A player can inspect the SVG's geometry, just as they can inspect the pixels of any image; it contains no secret text, letter labels, encoding metadata or answer fields before reveal.

## Local development

The Vite development server does not execute Vercel functions automatically. Use `vercel dev` for end-to-end local testing, with the environment variable configured in the local Vercel environment. The Playwright browser tests mock `/api/hide` and `/api/reveal`.

## Public-repository caveat

The encoding plan is not shipped in the browser bundle or returned by the Hider API before reveal. However, this repository is public, so a person who reads the GitHub source can inspect the server implementation itself. If the requirement is to hide the algorithm from source-code readers as well as from the browser and Seeker model, the server implementation must live in a private repository/service. This does not change what Pollinations Seeker receives: only the rendered image and blind prompt.
