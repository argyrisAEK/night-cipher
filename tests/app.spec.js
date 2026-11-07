import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('nc-howto-seen', '1'); } catch {} });
  await page.goto('/');
});

test('loads all game modes and the BYOP connect control', async ({ page }) => {
  await expect(page.locator('polli-connect')).toHaveAttribute('models', 'text');
  await expect(page.locator('#tabs button')).toHaveCount(4);
  await expect(page.locator('#levels button')).toHaveCount(10);
  await expect(page.locator('#levels')).toBeHidden();
  await expect(page.locator('#status')).not.toBeEmpty();
});

test('Learn opens the ten training levels', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Learn' }).click();
  await expect(page.locator('#levels')).toBeVisible();
  await expect(page.locator('#levels button.on')).toContainText('Level 1');
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
      own: buildSeekPrompt({ mode: 'own', scheme: TRAIN[8].s }),
      blind: buildSeekPrompt({ mode: 'duel', scheme: TRAIN[8].s }),
      retry: buildSeekPrompt({ mode: 'duel', scheme: TRAIN[8].s }, { retry: true })
    };
  });
  expect(prompts.guided).toContain('Petal count');
  expect(prompts.guided).toContain('One petal is A');
  expect(prompts.own).toContain('Petal count');
  expect(prompts.blind).not.toContain('DECODING RULE:');
  expect(prompts.blind).toContain('count each visible petal');
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

test('all ten deterministic cipher generators still round-trip through their decoders', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const [{ TRAIN, P }, { DEC }] = await Promise.all([
      import('/js/ciphers.js'),
      import('/js/selftest.js')
    ]);
    return TRAIN.map((cipher, index) => {
      const svg = cipher.g(cipher.m, 20261106 + index);
      return { name: cipher.n, expected: cipher.m, actual: DEC[index](P(svg)) };
    });
  });
  expect(results).toHaveLength(10);
  for (const result of results) {
    expect(result.actual, result.name).toBe(result.expected);
  }
});

test('Bloom petals form one evenly spaced, non-overlapping ring per letter', async ({ page }) => {
  const data = await page.evaluate(async () => {
    const { TRAIN } = await import('/js/ciphers.js');
    const doc = new DOMParser().parseFromString(TRAIN[8].g('MEADOW', 31), 'image/svg+xml');
    return [...doc.querySelectorAll('g[data-cipher="petals"]')].map(group => {
      const center = group.querySelector('[data-cipher="flower-center"]');
      const cx = Number(center.getAttribute('cx')), cy = Number(center.getAttribute('cy'));
      const petals = [...group.querySelectorAll('ellipse[data-cipher="petal"]')];
      return {
        count: petals.length,
        radii: petals.map(p => Math.hypot(Number(p.getAttribute('cx'))-cx, Number(p.getAttribute('cy'))-cy))
      };
    });
  });
  expect(data.map(x => x.count)).toEqual([13, 5, 1, 4, 15, 23]);
  for (const flower of data) {
    for (const radius of flower.radii) expect(radius).toBeGreaterThan(38.5);
    for (const radius of flower.radii) expect(radius).toBeLessThan(39.5);
  }
});

test('guess counter shows tries left and drops after a wrong guess', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Learn' }).click();
  await expect(page.locator('#tries')).toHaveText('●●●');
  await page.fill('#guess', 'wrongword');
  await page.click('#go');
  await expect(page.locator('#tries')).toHaveText('●●○');
});

test('AI modes start with an empty stage and the counter clears when a round ends', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Learn' }).click();
  await expect(page.locator('#imgbox img')).toHaveCount(1);
  await page.click('#giveup');
  await expect(page.locator('#tries')).toHaveText('');
  await page.locator('#tabs button', { hasText: 'Duel' }).click();
  await expect(page.locator('#imgbox img')).toHaveCount(0);
  await expect(page.locator('#imgbox')).toContainText('Your picture will appear here');
  await expect(page.locator('#hide')).toContainText('💰');
  await expect(page.locator('section.card #robustnessReport')).toHaveCount(1);
});

test('first visit shows How to play once, and it can be reopened', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.removeItem('nc-howto-seen'); } catch {} });
  await page.reload();
  await expect(page.locator('#howto')).toBeVisible();
  await expect(page.locator('#howto')).toContainText('Study the picture');
  await page.click('#howtoClose');
  await expect(page.locator('#howto')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('nc-howto-seen'))).toBe('1');
  await page.click('#howtoBtn');
  await expect(page.locator('#howto')).toBeVisible();
});
