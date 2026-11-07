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
  await expect(page.locator('#imgbox')).toContainText('AI Hider will hide it');
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
test('built-in self-test passes completely, including the secret-leak detector', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/?selftest');
  await expect(page.locator('#st')).toContainText(/\b(\d+)\/\1 passed/, { timeout: 45000 });
  await expect(page.locator('#st')).not.toContainText('❌');
});

test('AI model settings are open by default, collapsible, and carry the budget tooltip', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Duel' }).click();
  await expect(page.locator('#hider')).toBeVisible();
  await expect(page.locator('#hider')).toHaveAttribute('title', /budget caps the spending/);
  await expect(page.locator('details.adv')).not.toContainText('catalog metadata');
  await page.locator('details.adv > summary').click();
  await expect(page.locator('#hider')).toBeHidden();
  await page.locator('details.adv > summary').click();
  await expect(page.locator('#hider')).toBeVisible();
});

test('AI vs AI Duel clearly assigns both AI roles and reveals the seeker result immediately', async ({ page }) => {
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json: { data: [
      { id: 'test-hider' },
      { id: 'test-vision-seeker', input_modalities: ['image'] }
    ] }
  }));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body = route.request().postDataJSON();
    const isHider = body.messages.some(m => JSON.stringify(m).includes('SECRET MESSAGE'));
    const content = isHider
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="#ffd166"/></svg>\nSCHEME: The circle contains a sequence of visual marks.'
      : 'MESSAGE: LANTERN\nMETHOD: Count the marks in the central symbol.';
    await route.fulfill({ json: { choices: [{ message: { content } }], usage: { total_tokens: 12 } } });
  });
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('#hider option')].some(option => option.value === 'test-hider'));
  await page.evaluate(() => { Object.defineProperty(document.querySelector('polli-connect'), 'apiKey', { value: 'test-key', configurable: true }); });
  await expect(page.locator('#tabs button', { hasText: 'AI vs AI Duel' })).toBeVisible();
  await page.locator('#tabs button', { hasText: 'AI vs AI Duel' }).click();
  await page.fill('#msg', 'LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#guess')).toBeHidden();
  await expect(page.locator('#go')).toBeHidden();
  await expect(page.locator('#hint')).toBeHidden();
  await expect(page.locator('#giveup')).toBeHidden();
  await expect(page.locator('#duelRoles')).toBeVisible();
  await expect(page.locator('#duelRoles')).toContainText('AI Hider');
  await expect(page.locator('#duelRoles')).toContainText('AI Seeker');
  await expect(page.locator('#ai')).toContainText('Challenge AI Seeker');
  await expect(page.locator('#revealHow')).toBeVisible();
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('AI seeker said: “LANTERN”', { timeout: 10000 });
  await expect(page.locator('#status')).toContainText('decoded the message chosen for this duel');
});

test('Duel message is limited to 24 characters with a live counter', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Duel' }).click();
  const msg = page.locator('#msg');
  await expect(msg).toHaveAttribute('maxlength', '24');
  await msg.fill('');
  await msg.pressSequentially('ABCDEFGHIJ KLMNOPQRSTUVWXYZ');
  await expect(msg).toHaveValue('ABCDEFGHIJ KLMNOPQRSTUVW');
  await expect(page.locator('#msgCount')).toHaveText('24 / 24');
  await page.evaluate(() => { document.querySelector('#msg').value = 'A'.repeat(25); });
  await page.click('#hide');
  await expect(page.locator('#status')).toContainText('Use 3–24 characters');
});

test('deterministic encoding selector respects length, avoids repeats and yields decodable plans', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { pickPlan, decodePlan, eligibleMethods } = await import('/js/encoding.js');
    const msg = 'SEE YOU AT NOON';
    const a = pickPlan(msg, { round: 3 }), b = pickPlan(msg, { round: 3 });
    let last = '', lastScene = '', repeats = 0, roundtrip = true;
    for (let i = 0; i < 12; i++) {
      const p = pickPlan(msg, { lastMethod: last, lastScene, round: i });
      if (p.method === last || p.scene === lastScene) repeats++;
      if (decodePlan(p) !== msg) roundtrip = false;
      last = p.method; lastScene = p.scene;
    }
    const covered = new Set(Array.from({ length: 12 }, (_, i) => pickPlan(msg, { round: i }).method)).size;
    return {
      eighteen: eligibleMethods('THE BEES KNOW THE WAY'), twelve: eligibleMethods(msg), twentyFour: eligibleMethods('ABCDEFGHIJKLMNOPQRSTUVWX'),
      deterministic: a.method === b.method && a.scene === b.scene && a.spec === b.spec, repeats, roundtrip, covered,
      longDecodes: decodePlan(pickPlan('THE BEES KNOW THE WAY', { round: 1 })) === 'THE BEES KNOW THE WAY'
    };
  });
  expect(r.eighteen).toEqual(['binary', 'morse']);
  expect(r.twelve).toEqual(['counts', 'binary', 'morse']);
  expect(r.twentyFour).toEqual(['morse']);
  expect(r.deterministic).toBe(true);
  expect(r.repeats).toBe(0);
  expect(r.roundtrip).toBe(true);
  expect(r.longDecodes).toBe(true);
  expect(r.covered).toBeGreaterThanOrEqual(2);
});

test('HIDE prompt fixes encoding, scene and symbols when a plan is supplied', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { pickPlan } = await import('/js/encoding.js');
    const { HIDE } = await import('/js/api.js');
    const plan = pickPlan('SEE YOU', { round: 1 });
    const fixed = HIDE('SEE YOU', false, plan), legacy = HIDE('SEE YOU', false);
    return { plan, fixed, legacy };
  });
  expect(r.fixed).toContain('fixed the encoding for this round: ' + r.plan.label);
  expect(r.fixed).toContain(r.plan.spec);
  expect(r.fixed).toContain(r.plan.scene);
  expect(r.fixed).not.toContain('Choose ONE reliable');
  expect(r.fixed).not.toContain('Choose a scene that naturally suits');
  expect(r.legacy).toContain('Choose ONE reliable');
});

test('AI vs AI Duel sends a fixed plan to the Hider, records the method and rotates it', async ({ page }) => {
  const prompts = [];
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json: { data: [{ id: 'test-hider' }, { id: 'test-vision-seeker', input_modalities: ['image'] }] }
  }));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body = route.request().postDataJSON();
    const text = JSON.stringify(body.messages);
    const isHider = text.includes('SECRET MESSAGE');
    if (isHider) prompts.push(body.messages.map(m => m.content).join('\n'));
    const content = isHider
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="#ffd166"/></svg>\nSCHEME: Marks follow the fixed plan.'
      : 'MESSAGE: LANTERN\nMETHOD: Count the marks.';
    await route.fulfill({ json: { choices: [{ message: { content } }], usage: { total_tokens: 12 } } });
  });
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('#hider option')].some(o => o.value === 'test-hider'));
  await page.evaluate(() => { Object.defineProperty(document.querySelector('polli-connect'), 'apiKey', { value: 'test-key', configurable: true }); });
  await page.locator('#tabs button', { hasText: 'AI vs AI Duel' }).click();
  await page.fill('#msg', 'LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({ timeout: 10000 });
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('Method fixed by the game', { timeout: 10000 });
  await page.click('#hide');
  await expect.poll(() => prompts.length, { timeout: 10000 }).toBe(2);
  const label = p => (p.match(/fixed the encoding for this round: ([^\n]*?)\. Do not/) || [])[1];
  expect(label(prompts[0])).toBeTruthy();
  expect(label(prompts[1])).toBeTruthy();
  expect(label(prompts[1])).not.toBe(label(prompts[0]));
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('nc')).duelLog);
  expect(log.n).toBeGreaterThanOrEqual(1);
  expect(['counts', 'binary', 'morse']).toContain(log.method);
});
