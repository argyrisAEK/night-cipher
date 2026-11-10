import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LENGTHS = [5, 10, 15, 20, 26];
const VARIANTS = ['original', 'jpeg55', 'downscale50', 'blur2'];
const OUTPUT = path.resolve('test-results/blind-seeker');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('nc-howto-seen', '1'); } catch {} });
  await page.goto('/');
});
test('Blind Seeker dataset: export blinded images and a separate answer key', async ({ page }) => {
  test.setTimeout(120_000);
  const generated = await page.evaluate(async ({ lengths, variants }) => {
    const { TRAIN } = await import('/js/ciphers.js');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cases = [];
    const rasterize = async svg => {
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 800; canvas.height = 500;
      const context = canvas.getContext('2d');
      context.fillStyle = '#080d20';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, 800, 500);
      return canvas;
    };
    const encode = (canvas, variant) => {
      if (variant === 'original') return canvas.toDataURL('image/png');
      if (variant === 'jpeg55') return canvas.toDataURL('image/jpeg', 0.55);
      if (variant === 'downscale50') {
        const half = document.createElement('canvas');
        half.width = 400; half.height = 250;
        half.getContext('2d').drawImage(canvas, 0, 0, 400, 250);
        const restored = document.createElement('canvas');
        restored.width = 800; restored.height = 500;
        restored.getContext('2d').drawImage(half, 0, 0, 800, 500);
        return restored.toDataURL('image/png');
      }
      const blurred = document.createElement('canvas');
      blurred.width = 800; blurred.height = 500;
      const context = blurred.getContext('2d');
      context.filter = 'blur(2px)';
      context.drawImage(canvas, 0, 0);
      context.filter = 'none';
      return blurred.toDataURL('image/png');
    };
    let ordinal = 0;
    for (let cipherIndex = 0; cipherIndex < TRAIN.length; cipherIndex++) {
      for (const length of lengths) {
        const message = Array.from({ length }, (_, i) =>
          alphabet[(i * 11 + length * 3) % 26]
        ).join('');
        const seed = 9000 + cipherIndex * 100 + length;
        const canvas = await rasterize(TRAIN[cipherIndex].g(message, seed));
        for (const variant of variants) {
          ordinal++;
          const trialId = 'trial-' + String(ordinal).padStart(3, '0');
          cases.push({
            trialId,
            imageDataUrl: encode(canvas, variant),
            answer: {
              trialId,
              cipher: TRAIN[cipherIndex].n,
              length,
              expectedMessage: message,
              seed,
              variant
            }
          });
        }
      }
    }
    return cases;
  }, { lengths: LENGTHS, variants: VARIANTS });

  const publicDir = path.join(OUTPUT, 'public');
  const privateDir = path.join(OUTPUT, 'private');
  await mkdir(publicDir, { recursive: true });
  await mkdir(privateDir, { recursive: true });

  const publicManifest = {
    schemaVersion: 1,
    description: 'Blind image set. Do not provide the answer key or cipher metadata to the Seeker.',
    canvas: { width: 800, height: 500 },
    trialCount: generated.length,
    trials: []
  };
  const answerKey = {
    schemaVersion: 1,
    description: 'Evaluator-only mapping. Never include this file in a Seeker request.',
    generatedAt: new Date().toISOString(),
    trials: []
  };

  for (const item of generated) {
    const extension = item.answer.variant === 'jpeg55' ? '.jpg' : '.png';
    const filename = item.trialId + extension;
    const base64 = item.imageDataUrl.slice(item.imageDataUrl.indexOf(',') + 1);
    await writeFile(path.join(publicDir, filename), Buffer.from(base64, 'base64'));
    publicManifest.trials.push({ trialId: item.trialId, image: filename });
    answerKey.trials.push(item.answer);
  }

  // Shuffle presentation order deterministically so cipher blocks are not adjacent.
  publicManifest.trials.sort((a, b) => ((Number(a.trialId.slice(6)) * 37) % 211) - ((Number(b.trialId.slice(6)) * 37) % 211));
  await writeFile(path.join(publicDir, 'manifest.json'), JSON.stringify(publicManifest, null, 2) + '\n');
  await writeFile(path.join(privateDir, 'answer-key.json'), JSON.stringify(answerKey, null, 2) + '\n');

  expect(generated).toHaveLength(10 * LENGTHS.length * VARIANTS.length);
  expect(publicManifest.trials.every(item => !('expectedMessage' in item) && !('cipher' in item))).toBe(true);
  expect(JSON.stringify(publicManifest)).not.toContain('expectedMessage');
  expect(answerKey.trials).toHaveLength(generated.length);
});
