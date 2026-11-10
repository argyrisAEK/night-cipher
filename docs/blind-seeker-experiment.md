# Blind Seeker Recognition Experiment

## Purpose

Measure whether an independent vision Seeker can recover messages from the ten deterministic training ciphers, then quantify the effect of image degradation. This is an evaluation dataset and protocol; it does not modify production renderers or automatically spend Pollen.

## Dataset generation

Run:

```bash
npm test -- tests/blind-seeker-dataset.spec.js
```

The Playwright test creates 200 image trials: 10 ciphers × 5 message lengths (5, 10, 15, 20, 26) × 4 image conditions:

- Original PNG baseline
- JPEG quality 55%
- 50% downscale followed by restoration to 800×500
- Gaussian blur, radius 2 px

Every cipher/length pair uses a deterministic message and seed. The exact same source raster is used to derive its three degraded variants.

Outputs:

- `test-results/blind-seeker/public/`: images and a manifest containing only opaque trial IDs and image filenames.
- `test-results/blind-seeker/private/answer-key.json`: evaluator-only cipher, length, seed, expected message and condition.

**Never attach or send the private answer key to the Seeker.** Keep public and private outputs separate when sharing or uploading artifacts. CI should publish them as separate artifacts with restricted access where possible; do not combine them into one downloadable bundle for an external evaluator.

## Blind protocol

1. Select one vision-capable Seeker model and freeze its model ID, prompt, temperature (if supported), token limit and request timeout for the full run.
2. Give the Seeker one image at a time. Do not provide the cipher name, message length, expected text, seed, variant label, answer key, renderer source, or previous trial answers.
3. Use the same neutral instruction for every trial: identify any hidden message; return a single `MESSAGE:` line and a concise `METHOD:` line. If the image is not decodable, return `MESSAGE: NONE`.
4. Randomize trial order. Do not let the Seeker retain conversation context between trials; use a fresh request/conversation per image.
5. Record the raw response, normalized decoded message, request duration, model ID, token usage, status/error category and trial ID. Never silently discard failed requests.
6. Only after all Seeker responses are frozen, join them to the private answer key and score the results.

## Metrics

- **Exact recovery:** normalized decoded message equals the expected message.
- **Character accuracy:** 1 − Levenshtein distance / max(expected length, decoded length). Report insertions/deletions as well as substitutions through the edit distance.
- **Latency:** end-to-end request duration in milliseconds; report median and p95, excluding no failures from the failure-rate denominator.
- **Failure rate:** request, timeout or response-parse failures / attempted trials. A valid `NONE` is a decoding miss, not a request failure.
- **Robustness delta:** exact-recovery and character-accuracy change from each cipher's original PNG baseline to each degradation condition.

Report results by cipher, message length, image condition and model. Include denominators and confidence intervals; do not rank ciphers from a handful of trials.

## Interpretation safeguards

- The test corpus is uppercase A–Z only because the current training renderers encode individual letters, not spaces.
- The deterministic training encoders are controlled stimuli, not representative samples of AI-generated Hider artwork. Keep AI Hider evaluations as a separate experiment.
- Geometry metrics (clipping and axis-aligned overlap) are diagnostic covariates only, not recognition scores.
- A low score can reflect model capability, prompt choice, image condition or the cipher. Keep all non-cipher variables fixed before attributing causality.
- No renderer redesign is authorized by this experiment alone. Require repeated trials and uncertainty estimates before recommending a change.

## Scope

This phase prepares a reproducible, blinded image corpus. It deliberately does not invoke a paid model automatically. The actual Seeker run must be performed by the evaluator using the frozen model/prompt configuration and the public image set only.
