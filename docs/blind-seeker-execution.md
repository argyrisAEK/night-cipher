# Blind Seeker execution and scoring

## Frozen configuration

The benchmark uses the app's existing blind Seeker prompt exported as `SEEK` from `js/api.js`, unchanged. The model is the app's configured default primary vision Seeker, `openai/gpt-6.1-terra`. Requests use the same OpenAI-compatible Pollinations chat-completions endpoint, `max_tokens: 4000`, and a 90-second timeout. Each image gets a fresh, independent request with no conversation history. The script records a SHA-256 hash of the exact prompt and the provider-returned model ID.

## Important answer-key privacy correction

The GitHub Actions artifact containing `private/answer-key.json` is not a secure private channel in a public repository. Do not distribute it. The CI workflow now uploads only the public image dataset. Generate the answer key locally by running the Playwright dataset test; the private file remains under `test-results/blind-seeker/private/` on that machine.

## Generate and run locally

Use Node 22 and install dependencies first:

```bash
npm install
npx playwright install chromium
npm test -- tests/blind-seeker-dataset.spec.js
```

Set the Pollinations API key in your local shell as `POLLINATIONS_API_KEY`. Never commit it or paste it into chat. Then inspect the public manifest and approve paid execution:

```bash
# Small pilot first (10 requests)
POLLINATIONS_API_KEY=... node scripts/blind-seeker-run.mjs --limit 10 --confirm-paid

# Continue remaining trials; existing trial IDs are checkpointed and skipped
POLLINATIONS_API_KEY=... node scripts/blind-seeker-run.mjs --confirm-paid

# Score completed responses against the local answer key
node scripts/blind-seeker-score.mjs
```

On PowerShell, set the environment variable with `$env:POLLINATIONS_API_KEY="..."` before running the commands. The runner is sequential by default, waits 350 ms between calls, writes each response immediately to `seeker-results.jsonl`, and resumes by skipping trial IDs already present. It never sends the answer key or any cipher/message metadata to the model. Use the 10-request pilot to verify the account, model availability, response format and spend before running all 200.

## Output and metrics

- `seeker-results.jsonl`: run metadata, prompt hash, raw Seeker responses, model ID, usage, request status and latency. This is the immutable response log; retain it.
- `scored-report.json`: evaluator join and metrics by cipher, cipher × degradation, and cipher × message length × degradation.

Definitions:
- Exact recovery: normalized decoded message equals the expected message.
- Character accuracy: `1 - Levenshtein distance / max(expected length, decoded length)`. API and parse failures score zero; valid `NONE` is a decoding miss.
- Failure rate: request, timeout and response-parse failures divided by attempted requests. Valid `NONE` is excluded.
- Latency: median and p95 across attempted requests with measured durations.

This first corpus has one deterministic message per length, reused across all ciphers, and one generated image per cipher/length/condition. The 200 image calls are not 200 independent message samples. Treat results as a controlled first pass, not a statistically representative ranking. Follow up with multiple independently generated messages/seeds before renderer decisions.
