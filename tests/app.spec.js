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
  expect(prompts.blind).toContain('blind AI SEEKER');
  expect(prompts.blind).toContain('Do not assume the answer uses A=1');
  expect(prompts.retry).toContain('Second-pass blind visual analysis');
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


test('all AI model selectors expose only the eight approved Pollinations models', async ({ page }) => {
  const expected = [
    'openai/gpt-6.1-sol',
    'openai/gpt-6-luna',
    'openai/gpt-6.1-terra',
    'openai/gpt-6-astra',
    'community/Lorodn4x/qwen3.8-plus',
    'community/vendouple/gpt-6-luna',
    'community/vendouple/gpt-6-astra',
    'community/vendouple/gemini-3.8-flash'
  ];
  for (const selector of ['#hider', '#seeker', '#seeker2', '#seekerAudit', '#judgeModel']) {
    const actual = await page.locator(selector + ' option').evaluateAll(options => options.map(o => o.value));
    expect(actual).toEqual(expected);
  }
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

test('AI Hider authors the complete organic image and Seeker receives only the blind image', async ({ page }) => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/><rect x="100" y="100" width="50" height="70" fill="#f1c987"/><rect x="220" y="100" width="50" height="70" fill="#f1c987"/></svg>';
  const scheme='The illuminated windows in each natural cluster encode A=1 through Z=26, read left to right; wider gaps separate words.';
  let hiderBody=null,seekerBody=null,chatCalls=0,serverCalls=0;
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json:{data:[{id:'openai/gpt-6.1-sol'},{id:'community/vendouple/gemini-3.8-flash',input_modalities:['image']}]}
  }));
  await page.route('**/api/**', route => {serverCalls++;return route.fulfill({status:404,body:'not found'})});
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    chatCalls++;
    const body=route.request().postDataJSON();
    if(body.model==='openai/gpt-6.1-sol'){
      hiderBody=body;
      await route.fulfill({json:{
        model:'openai/gpt-6.1-sol',
        choices:[{message:{content:svg+'\nSCHEME: '+scheme},finish_reason:'stop'}],
        usage:{total_tokens:140,completion_tokens:110}
      }});
    }else{
      seekerBody=body;
      await route.fulfill({json:{
        model:'community/vendouple/gemini-3.8-flash',
        choices:[{message:{content:'MESSAGE: LANTERN\nMETHOD: The natural window pattern encodes the letters.'},finish_reason:'stop'}],
        usage:{total_tokens:60,completion_tokens:35}
      }});
    }
  });
  await page.reload();
  await page.waitForFunction(()=>[...document.querySelectorAll('#hider option')].some(o=>o.value==='openai/gpt-6.1-sol'));
  await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.fill('#msg','LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});
  expect(hiderBody.model).toBe('openai/gpt-6.1-sol');
  expect(JSON.stringify(hiderBody.messages)).toContain('LANTERN');
  expect(JSON.stringify(hiderBody.messages)).toContain('ordinary image');
  expect(JSON.stringify(hiderBody.messages)).toContain('SCHEME:');
  await expect(page.locator('#revealHow')).toBeHidden();
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('AI seeker said: “LANTERN”',{timeout:10000});
  expect(JSON.stringify(seekerBody.messages)).not.toContain('LANTERN');
  expect(JSON.stringify(seekerBody.messages)).not.toContain(scheme);
  expect(seekerBody.messages[0].content.some(part=>part.type==='image_url')).toBe(true);
  expect(chatCalls).toBe(2);
  expect(serverCalls).toBe(0);
  await expect(page.locator('#revealHow')).toBeVisible();
  await page.click('#revealHow');
  await expect(page.locator('#res')).toContainText(scheme);
  expect(chatCalls).toBe(2);
});

test('Hider diagnostics capture its private explanation while the Seeker request remains blind', async ({ page }) => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>';
  const scheme='A natural sequence of window lights maps counts to alphabet positions.';
  let seekerMessages='';
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json:{data:[{id:'openai/gpt-6.1-sol'},{id:'community/vendouple/gemini-3.8-flash',input_modalities:['image']}]}
  }));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body=route.request().postDataJSON();
    const content=body.model==='openai/gpt-6.1-sol'?svg+'\nSCHEME: '+scheme:'MESSAGE: LANTERN\nMETHOD: I decoded the window sequence.';
    if(body.model==='community/vendouple/gemini-3.8-flash')seekerMessages=JSON.stringify(body.messages);
    await route.fulfill({json:{model:body.model,choices:[{message:{content},finish_reason:'stop'}],usage:{total_tokens:25,completion_tokens:18}}});
  });
  await page.reload();
  await page.waitForFunction(()=>[...document.querySelectorAll('#hider option')].some(o=>o.value==='openai/gpt-6.1-sol'));
  await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.fill('#msg','LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});
  await expect(page.locator('#diagnosticsContent')).toContainText('AI-selected organic visual encoding');
  await page.click('#ai');
  await expect(page.locator('#diagnosticsContent')).toContainText('MESSAGE: LANTERN',{timeout:10000});
  expect(seekerMessages).not.toContain(scheme);
  expect(seekerMessages).not.toContain('LANTERN');
  await page.locator('#diagnostics > summary').click();
  const report=JSON.parse(await page.locator('#diagnosticsContent details').last().locator('pre').textContent());
  expect(report.hider.rawResponse).toContain('SCHEME:');
  expect(report.hider.svg).toContain('<svg');
  expect(report.seeker.decodedMessage).toBe('LANTERN');
  expect(report.result.exactMatch).toBe(true);
  expect(report.hider.validation.renderValid).toBe(true);
  expect(report.hider.validation.schemePresent).toBe(true);
  expect(report.seeker.blindAudit.verified).toBe(true);
  expect(report.seeker.blindAudit.secretExcluded).toBe(true);
  expect(report.seeker.blindAudit.schemeExcluded).toBe(true);
  expect(report.seeker.imageReceived).toBe(true);
  expect(report.seeker.usage.total_tokens).toBe(25);
  expect(JSON.stringify(report)).not.toContain('test-key');
});

test('independent Seeker gets only the blind prompt and records exact recovery metrics', async ({ page }) => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>';
  const scheme='Boats encode Morse letters using round and elongated lights.';
  const requests=[];
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({json:{data:[
    {id:'openai/gpt-6.1-sol'},{id:'community/vendouple/gemini-3.8-flash',input_modalities:['image']},{id:'openai/gpt-6-astra',input_modalities:['image']}
  ]}}));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body=route.request().postDataJSON();requests.push(body);
    const content=body.model==='openai/gpt-6.1-sol'?svg+'\nSCHEME: '+scheme:
      body.model==='community/vendouple/gemini-3.8-flash'?'MESSAGE: KNOW THE WAY\nMETHOD: I read the light clusters.':
      'MESSAGE: KNOW THE WAY\nMETHOD: I independently decoded the light pattern.';
    await route.fulfill({json:{model:body.model,choices:[{message:{content},finish_reason:'stop'}],usage:{total_tokens:40,completion_tokens:25}}});
  });
  await page.reload();
  await page.waitForFunction(()=>[...document.querySelectorAll('#hider option')].some(o=>o.value==='openai/gpt-6.1-sol'));
  await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.fill('#msg','KNOW THE WAY');
  await page.selectOption('#seeker','community/vendouple/gemini-3.8-flash');
  await page.selectOption('#seekerAudit','openai/gpt-6-astra');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible();
  await page.click('#independent');
  await expect(page.locator('#status')).toContainText('Run the primary Seeker first');
  expect(requests.some(x=>x.model==='openai/gpt-6-astra')).toBe(false);
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('KNOW THE WAY');
  await page.click('#independent');
  await expect(page.locator('#robustnessReport')).toContainText('Both exact: Yes');
  const primary=requests.find(x=>x.model==='community/vendouple/gemini-3.8-flash');
  const independent=requests.find(x=>x.model==='openai/gpt-6-astra');
  expect(independent.messages[0].content[1].image_url.url).toBe(primary.messages[0].content[1].image_url.url);
  expect(independent.messages[0].content[0].text).toBe(primary.messages[0].content[0].text);
  expect(JSON.stringify(independent.messages)).not.toContain('KNOW THE WAY');
  expect(JSON.stringify(independent.messages)).not.toContain(scheme);
  expect(independent.messages[0].content.some(x=>x.type==='image_url')).toBe(true);
  await page.locator('#diagnostics > summary').click();
  const report=JSON.parse(await page.locator('#diagnosticsContent details').last().locator('pre').textContent());
  expect(report.independentSeeker.exactMatch).toBe(true);
  expect(report.independentSeeker.blindAudit.verified).toBe(true);
  expect(report.independentSeeker.imageReceived).toBe(true);
  expect(report.independentSeeker.usage.total_tokens).toBe(40);
  expect(report.quality.bothExact).toBe(true);
  expect(report.quality.agreement).toBe(true);
});

test('quality helpers distinguish unmeasured validation from failed recovery and audit blind payloads', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { auditBlindRequest, compareSeekers, normalizeMessage } = await import('/js/quality.js');
    return {
      notRun: compareSeekers({ normalized: 'HELLO', exactMatch: true }, null),
      complete: compareSeekers({ normalized: 'HELLOWORLD', exactMatch: true }, { normalized: 'HELLOWORLD', exactMatch: true }),
      secretLeak: auditBlindRequest({ prompt: 'Decode HELLO WORLD', secret: 'HELLO WORLD', scheme: 'Read the stars', imageAttached: true }),
      schemeLeak: auditBlindRequest({ prompt: 'Read the stars', secret: 'HELLO WORLD', scheme: 'Read the stars', imageAttached: true }),
      valid: auditBlindRequest({ prompt: 'Study the image and infer its visual rule', secret: 'HELLO WORLD', scheme: 'Read the stars', imageAttached: true }),
      commonWord: auditBlindRequest({ prompt: 'Study the image as a coherent scene and return one concise sentence', secret: 'THE', scheme: 'Read the stars', imageAttached: true }),
      spacedMessage: normalizeMessage('MEET ME AT MIDNIGHT'),
      joinedMessage: normalizeMessage('MEETMEATMIDNIGHT')
    };
  });
  expect(result.notRun.complete).toBe(false);
  expect(result.notRun.agreement).toBeNull();
  expect(result.notRun.bothExact).toBeNull();
  expect(result.notRun.primaryExact).toBe(true);
  expect(result.complete.bothExact).toBe(true);
  expect(result.secretLeak.verified).toBe(false);
  expect(result.schemeLeak.verified).toBe(false);
  expect(result.valid.verified).toBe(true);
  expect(result.commonWord.verified).toBe(true);
  expect(result.spacedMessage).not.toBe(result.joinedMessage);
});

test('Diagnostics sit in the left card under the picture, not in the crowded right column', async ({ page }) => {
  await expect(page.locator('section.card #diagnostics')).toHaveCount(1);
  await expect(page.locator('aside #diagnostics')).toHaveCount(0);
  const order = await page.evaluate(() => {
    const d = document.querySelector('#diagnostics'), img = document.querySelector('#imgbox');
    return !!(img.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
});
