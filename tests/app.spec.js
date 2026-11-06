import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads all game modes and the BYOP connect control', async ({ page }) => {
  await expect(page.locator('polli-connect')).toHaveAttribute('models', 'text,image');
  await expect(page.locator('#tabs button')).toHaveCount(13);
  await expect(page.locator('#status')).not.toBeEmpty();
});

test('Bloom cipher encodes each letter as a visibly countable number of petals', async ({ page }) => {
  const counts = await page.evaluate(async () => {
    const { TRAIN } = await import('/js/ciphers.js');
    const svg = TRAIN[8].g('MEADOW', 31);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return [...doc.querySelectorAll('g[data-cipher="petals"]')]
      .map(group => group.querySelectorAll('ellipse[data-cipher="petal"]').length);
  });
  expect(counts).toEqual([13, 5, 1, 4, 15, 23]);
});

test('known training and daily ciphers use guided decoding instructions', async ({ page }) => {
  const prompts = await page.evaluate(async () => {
    const [{ TRAIN }, { buildSeekPrompt }] = await Promise.all([
      import('/js/ciphers.js'),
      import('/js/api.js')
    ]);
    return {
      guided: buildSeekPrompt({ mode: 'daily', scheme: TRAIN[8].s }),
      blind: buildSeekPrompt({ mode: 'duel', scheme: TRAIN[8].s }),
      retry: buildSeekPrompt({ mode: 'duel', scheme: TRAIN[8].s }, { retry: true })
    };
  });
  expect(prompts.guided).toContain('Petal count');
  expect(prompts.guided).toContain('One petal is A');
  expect(prompts.blind).not.toContain('DECODING RULE:');
  expect(prompts.retry).toContain('Second-pass visual cryptanalysis');
});

test('legacy nc LocalStorage progression remains readable', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('nc', JSON.stringify({
      xp: 1250,
      levels: { 0: true, 1: true },
      achievements: { first_decode: 1 },
      dailyWins: [20001]
    }));
  });
  await page.reload();
  await expect(page.locator('#profile')).toContainText('Cryptographer');
  await expect(page.locator('#codexPreview')).toContainText('Skyline');
});
