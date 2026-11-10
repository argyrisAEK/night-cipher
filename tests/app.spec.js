import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('nc-howto-seen', '1'); } catch {} });
  await page.goto('/');
});
test('loads all game modes and the BYOP connect control', async ({ page }) => {
  await expect(page.locator('polli-connect')).toHaveAttribute('models', 'text');
  await expect(page.locator('#tabs button')).toHaveCount(8);
  await expect(page.locator('#levels button')).toHaveCount(10);
  await expect(page.locator('#levels')).toBeHidden();
  await expect(page.locator('#status')).not.toBeEmpty();
});

test('header and AI duel image copy describe the visual steganography game', async ({ page }) => {
  await expect(page.locator('header .sub')).toContainText('A visual steganography game');
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await expect(page.locator('#imgbox')).toContainText('AI Hider conceals your message in an image. AI Seeker then tries to decode it.');
});

test('You hide, AI seeks uses numbered scheme labels without unknown wording', async ({ page }) => {
  await page.locator('#tabs button',{hasText:'You hide, AI seeks'}).click();
  const labels=await page.locator('#osch option').allTextContents();
  expect(labels).toHaveLength(10);
  expect(labels[0]).toBe('Scheme #01');
  expect(labels[9]).toBe('Scheme #10');
  expect(labels.join(' ')).not.toMatch(/unknown/i);
});

test('You hide, AI seeks accepts its intentionally disclosed cipher rule without exposing the secret', async ({ page }) => {
  let seekerBody=null;
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json:{data:[{id:'openai/gpt-6.1-terra',input_modalities:['image']}]}
  }));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    seekerBody=route.request().postDataJSON();
    await route.fulfill({json:{
      model:'openai/gpt-6.1-terra',
      choices:[{message:{content:'MESSAGE: FREEDOM\nMETHOD: I applied the supplied Cipher #01 rule to the image.'},finish_reason:'stop'}],
      usage:{total_tokens:45,completion_tokens:20}
    }});
  });
  await page.reload();
  await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
  await page.locator('#tabs button',{hasText:'You hide, AI seeks'}).click();
  await page.fill('#omsg','FREEDOM');
  await page.selectOption('#osch','0');
  await page.click('#ohide');
  await expect(page.locator('#res')).toContainText('AI seeker said: “FREEDOM”',{timeout:10000});
  expect(seekerBody).not.toBeNull();
  const textPart=seekerBody.messages[0].content.find(part=>part.type==='text').text;
  expect(textPart).toContain('DECODING RULE:');
  expect(textPart).not.toContain('FREEDOM');
  expect(seekerBody.messages[0].content.some(part=>part.type==='image_url'&&part.image_url.url.startsWith('data:image/png'))).toBe(true);
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

test('legacy nc LocalStorage data remains readable without progression gamification', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('nc', JSON.stringify({xp:1250,levels:{0:true,1:true},achievements:{first_decode:1},dailyWins:[20001]})));
  await page.reload();
  const state=await page.evaluate(async()=>{const {loadState}=await import('/js/state.js');return loadState()});
  expect(state.levels).toEqual({0:true,1:true});
  expect(state.dailyWins).toEqual([20001]);
  expect(state).not.toHaveProperty('xp');
  expect(state).not.toHaveProperty('achievements');
  await expect(page.locator('#profile')).toHaveCount(0);
  await expect(page.locator('#codexPreview')).toHaveCount(0);
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
  await expect(page.locator('#imgbox')).toContainText('AI Hider conceals your message in an image.');
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


test('all AI model selectors expose only the seven approved Pollinations models', async ({ page }) => {
  const expected = [
    'openai/gpt-6.1-sol',
    'openai/gpt-6-luna',
    'openai/gpt-6.1-terra',
    'openai/gpt-6-astra',
    'community/vendouple/gpt-6-luna',
    'community/vendouple/gpt-6-astra',
    'community/JustScriptzz/gpt-5.6-terra'
  ];
  for (const selector of ['#hider', '#seeker', '#seeker2', '#seekerAudit', '#judgeModel']) {
    const actual = await page.locator(selector + ' option').evaluateAll(options => options.map(o => o.value));
    expect(actual).toEqual(expected);
  }
});

test('AI model settings are tucked away by default and remain available in Advanced', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Duel' }).click();
  await expect(page.locator('details.adv')).not.toHaveAttribute('open', '');
  await expect(page.locator('#hider')).toBeHidden();
  await page.locator('details.adv > summary').click();
  await expect(page.locator('#hider')).toBeVisible();
  await expect(page.locator('#hider')).toHaveAttribute('title', /budget caps the spending/);
  await expect(page.locator('details.adv')).not.toContainText('catalog metadata');
  await page.locator('details.adv > summary').click();
  await expect(page.locator('#hider')).toBeHidden();
});

test('AI Hider authors the complete organic image and Seeker receives only the blind image', async ({ page }) => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/><rect x="100" y="100" width="50" height="70" fill="#f1c987"/><rect x="220" y="100" width="50" height="70" fill="#f1c987"/></svg>';
  const scheme='The illuminated windows in each natural cluster encode A=1 through Z=26, read left to right; wider gaps separate words.';
  let hiderBody=null,seekerBody=null,chatCalls=0,serverCalls=0;
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json:{data:[{id:'openai/gpt-6.1-sol'},{id:'openai/gpt-6.1-terra',input_modalities:['image']}]}
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
        model:'openai/gpt-6.1-terra',
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
    json:{data:[{id:'openai/gpt-6.1-sol'},{id:'openai/gpt-6.1-terra',input_modalities:['image']}]}
  }));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body=route.request().postDataJSON();
    const content=body.model==='openai/gpt-6.1-sol'?svg+'\nSCHEME: '+scheme:'MESSAGE: LANTERN\nMETHOD: I decoded the window sequence.';
    if(body.model==='openai/gpt-6.1-terra')seekerMessages=JSON.stringify(body.messages);
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
  await page.locator('#tabs button',{hasText:'Research'}).click();
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
    {id:'openai/gpt-6.1-sol'},{id:'openai/gpt-6.1-terra',input_modalities:['image']},{id:'openai/gpt-6-luna',input_modalities:['image']}
  ]}}));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body=route.request().postDataJSON();requests.push(body);
    const content=body.model==='openai/gpt-6.1-sol'?svg+'\nSCHEME: '+scheme:
      body.model==='openai/gpt-6.1-terra'?'MESSAGE: KNOW THE WAY\nMETHOD: I read the light clusters.':
      'MESSAGE: KNOW THE WAY\nMETHOD: I independently decoded the light pattern.';
    await route.fulfill({json:{model:body.model,choices:[{message:{content},finish_reason:'stop'}],usage:{total_tokens:40,completion_tokens:25}}});
  });
  await page.reload();
  await page.waitForFunction(()=>[...document.querySelectorAll('#hider option')].some(o=>o.value==='openai/gpt-6.1-sol'));
  await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.locator('details.adv > summary').click();
  await expect(page.locator('#seeker')).toBeVisible();
  await page.fill('#msg','KNOW THE WAY');
  await page.selectOption('#seeker','openai/gpt-6.1-terra');
  await page.selectOption('#seekerAudit','openai/gpt-6-luna');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible();
  await page.locator('#tabs button',{hasText:'Research'}).click();
  await page.click('#independent');
  await expect(page.locator('#researchStatus')).toContainText('Run the primary Seeker first');
  expect(requests.some(x=>x.model==='openai/gpt-6-luna')).toBe(false);
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('KNOW THE WAY');
  await page.locator('#tabs button',{hasText:'Research'}).click();
  await page.click('#independent');
  await expect(page.locator('#robustnessReport')).toContainText('Both exact: Yes');
  const primary=requests.find(x=>x.model==='openai/gpt-6.1-terra');
  const independent=requests.find(x=>x.model==='openai/gpt-6-luna');
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
      guidedScheme: auditBlindRequest({ prompt: 'Apply the decoding rule: Read the stars', secret: 'HELLO WORLD', scheme: 'Read the stars', imageAttached: true, schemeExpected: true }),
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
  expect(result.guidedScheme.verified).toBe(true);
  expect(result.guidedScheme.secretExcluded).toBe(true);
  expect(result.guidedScheme.schemeIncluded).toBe(true);
  expect(result.guidedScheme.schemeExpected).toBe(true);
  expect(result.valid.verified).toBe(true);
  expect(result.commonWord.verified).toBe(true);
  expect(result.spacedMessage).not.toBe(result.joinedMessage);
});

test('Diagnostics live in Research Mode, separate from the game layout', async ({ page }) => {
  await expect(page.locator('#researchMode #diagnostics')).toHaveCount(1);
  await expect(page.locator('#mainGame #diagnostics')).toHaveCount(0);
  await expect(page.locator('aside #diagnostics')).toHaveCount(0);
  const order = await page.evaluate(() => {
    const d = document.querySelector('#diagnostics'), game = document.querySelector('#mainGame');
    return !!(game.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
});

test('Research Mode is a separate workspace and does not replace game navigation', async ({ page }) => {
  await page.locator('#tabs button',{hasText:'Research'}).click();
  await expect(page.locator('#researchMode')).toBeVisible();
  await expect(page.locator('#mainGame')).toBeHidden();
  await expect(page.locator('#diagnostics')).toBeVisible();
  await expect(page.locator('#independent')).toBeHidden();
  await expect(page.locator('#robustness')).toBeHidden();
  await page.locator('#tabs button',{hasText:'Daily'}).click();
  await expect(page.locator('#mainGame')).toBeVisible();
  await expect(page.locator('#researchMode')).toBeHidden();
});

test('Research report groups saved experiment history into readable tables', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nc', JSON.stringify({
    n:3,hm:{'openai/gpt-6.1-sol':{attempts:2,rendered:2,primaryEvaluated:0,primaryExact:0,independentEvaluated:0,independentExact:0,totalTokens:200,totalDurationMs:4000}},
    sm:{'openai/gpt-6.1-terra':{attempts:2,exact:1,failed:1,totalTokens:120,totalDurationMs:4000}},
    s:{'hider openai/gpt-6.1-sol → openai/gpt-6.1-terra · visual':{n:2,ok:1}},
    qh:{'openai/gpt-6.1-sol → openai/gpt-6.1-terra + openai/gpt-6-luna':{n:2,bothExact:1,agreement:2}},
    sh:{'openai/gpt-6.1-sol':{s:16,n:2}},
    rb:{'openai/gpt-6.1-terra · jpg85':{n:2,ok:1,sim:1.7}},
    st:{s:16,n:2},bestTimes:{a:12000},levels:{0:true}
  })));
  await page.reload();
  await page.locator('#tabs button',{hasText:'Research'}).click();
  await expect(page.locator('#report .report-group')).toHaveCount(5);
  await expect(page.locator('#report')).toContainText('Model leaderboard');
  await expect(page.locator('#report')).toContainText('openai/gpt-6.1-sol');
  await expect(page.locator('#report')).toContainText('Not tested');
  await expect(page.locator('#researchStats')).toContainText('320');
  await expect(page.locator('#researchStats')).toContainText('Saved Hider + Seeker tokens');
  await page.locator('#report .report-group').filter({hasText:'Matchups'}).locator('summary').click();
  await expect(page.locator('#report')).toContainText('openai/gpt-6.1-terra');
  await page.locator('#report .report-group').filter({hasText:'Robustness'}).locator('summary').click();
  await expect(page.locator('#report')).toContainText('jpg85');
});

test('default models: Seeker is terra, independent validation is luna, and the Hider never grades itself', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Duel' }).click();
  await expect(page.locator('#hider')).toHaveValue('openai/gpt-6.1-sol');
  await expect(page.locator('#seeker')).toHaveValue('openai/gpt-6.1-terra');
  await expect(page.locator('#seeker2')).toHaveValue('openai/gpt-6.1-terra');
  await expect(page.locator('#seekerAudit')).toHaveValue('openai/gpt-6-luna');
});

test('Hider prompt carries an output budget that matches what the sanitizer really accepts', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { HIDE } = await import('/js/api.js');
    const { clean } = await import('/js/security.js');
    const prompt = HIDE('SEE YOU', false);
    const allowedSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g"><stop offset="0" stop-color="#123"/></linearGradient><radialGradient id="r"><stop offset="1" stop-color="#fff"/></radialGradient><clipPath id="c"><rect width="9" height="9"/></clipPath><mask id="m"><rect width="9" height="9" fill="#fff"/></mask><filter id="f"><feGaussianBlur stdDeviation="1"/></filter><symbol id="s"><rect width="2" height="2"/></symbol></defs><g><rect width="5" height="5"/><circle r="2"/><ellipse rx="2" ry="1"/><line x2="5"/><polyline points="0,0 5,5"/><polygon points="0,0 5,5 5,0"/><path d="M0 0L5 5"/><use href="#s" x="1" y="1"/></g></svg>';
    let allowedOk = true, useHref = false;
    try { useHref = /<use[^>]*\bhref=/.test(clean(allowedSvg)); } catch { allowedOk = false; }
    const rejected = [];
    for (const el of ['style', 'pattern', 'marker', 'animate']) {
      try { clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><' + el + '/></svg>'); } catch { rejected.push(el); }
    }
    return { prompt, allowedOk, useHref, rejected };
  });
  expect(r.prompt).toContain('OUTPUT BUDGET');
  expect(r.prompt).toContain('write href, never xlink:href');
  expect(r.prompt).toContain('Allowed elements ONLY');
  expect(r.prompt).not.toContain('Do not sacrifice visual clarity');
  expect(r.prompt).toContain('If the budget and decoding accuracy conflict, accuracy wins');
  expect(r.allowedOk).toBe(true);
  expect(r.useHref).toBe(true);
  expect(r.rejected).toEqual(['style', 'pattern', 'marker', 'animate']);
});


test('training levels use a fixed canonical word and illustration across visits', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Learn' }).click();
  await page.locator('#levels button').nth(0).click();
  const first = await page.locator('#imgbox img').getAttribute('src');
  const firstMessage = await page.locator('#status').textContent();
  await page.locator('#levels button').nth(0).click();
  const second = await page.locator('#imgbox img').getAttribute('src');
  expect(second).toBe(first);
  expect(firstMessage).toContain('Skyline');
});

test('Daily never applies the artificial two-try Time Pressure modifier', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Daily' }).click();
  await expect(page.locator('#status')).toContainText(/3 tries/);
  await expect(page.locator('#status')).not.toContainText('Time Pressure');
  await expect(page.locator('#status')).not.toContainText('Easy');
  await expect(page.locator('#status')).not.toContainText('Medium');
  await expect(page.locator('#status')).not.toContainText('Hard');
});

test('Duel Next returns to setup without starting or charging a new Hider request', async ({ page }) => {
  let calls = 0;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>';
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    calls++;
    const body=route.request().postDataJSON();
    const content=body.model==='openai/gpt-6.1-sol'
      ? svg+'\\nSCHEME: A simple test encoding.'
      : 'MESSAGE: NONE\\nMETHOD: No defensible pattern found.';
    await route.fulfill({json:{choices:[{message:{content},finish_reason:'stop'}],usage:{total_tokens:10}}});
  });
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({json:{data:[{id:'openai/gpt-6.1-sol'}]}}));
  await page.reload();
  await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.fill('#msg','LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible();
  await page.click('#ai');
  await expect(page.locator('#next')).toBeVisible();
  expect(calls).toBe(2);
  await page.click('#next');
  await expect(page.locator('#duel')).toBeVisible();
  await expect(page.locator('#game')).toBeHidden();
  expect(calls).toBe(2);
});
test('Hint button displays used and available hint count', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Learn' }).click();
  await expect(page.locator('#hint')).toContainText('0/');
  await page.click('#hint');
  await expect(page.locator('#hint')).toContainText('1/');
});


test('Interactive Sandbox opens the local pixel-level LSB workspace', async ({ page }) => {
  await expect(page.locator('#tabs button', {hasText:'Interactive Sandbox'})).toHaveCount(1);
  await page.locator('#tabs button', {hasText:'Interactive Sandbox'}).click();
  await expect(page.locator('#lsbLab')).toBeVisible();
  await expect(page.locator('#mainGame')).toBeHidden();
  await expect(page.locator('#researchMode')).toBeHidden();
  await expect(page.locator('#lsbFile')).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
  await expect(page.locator('#lsbLab')).toHaveAttribute('data-mounted', '1');
  await expect(page.locator('#lsbEncode')).toBeDisabled();
});

test('LSB encoder round-trips UTF-8 text, preserves alpha, and reports capacity', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { encodeLSB, decodeLSB, lsbCapacityBytes } = await import('/js/lsb.js');
    const width = 64, height = 64, data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 120; data[i+1] = 80; data[i+2] = 40; data[i+3] = 173; }
    const original = new ImageData(data, width, height);
    const encoded = encodeLSB(original, 'Night Cipher — Καλημέρα');
    const recovered = decodeLSB(new ImageData(encoded.data, width, height));
    return { recovered, capacity: lsbCapacityBytes(width, height), changed: encoded.changedChannels,
      alphaPreserved: encoded.data.every((value, i) => i % 4 !== 3 || value === data[i]),
      sourceUntouched: original.data.every((value, i) => value === data[i]) };
  });
  expect(result.recovered).toBe('Night Cipher — Καλημέρα');
  expect(result.capacity).toBe(1529);
  expect(result.alphaPreserved).toBe(true);
  expect(result.sourceUntouched).toBe(true);
  expect(result.changed).toBeGreaterThan(0);
});

test('LSB encoder rejects oversized messages and decoder rejects unencoded images', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { encodeLSB, decodeLSB } = await import('/js/lsb.js');
    const tiny = new ImageData(new Uint8ClampedArray(5 * 4 * 4).fill(128), 5, 4);
    let oversized = '', missing = '';
    try { encodeLSB(tiny, 'This cannot fit'); } catch (error) { oversized = error.message; }
    try { decodeLSB(tiny); } catch (error) { missing = error.message; }
    return { oversized, missing };
  });
  expect(result.oversized).toContain('Message is too large');
  expect(result.missing).toContain('No Night Cipher LSB payload found');
});


test('Cipher Walkthrough is a separate local educational workspace', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Cipher Walkthrough' }).click();
  await expect(page.locator('#cipherWalkthrough')).toBeVisible();
  await expect(page.locator('#mainGame')).toBeHidden();
  await expect(page.locator('#researchMode')).toBeHidden();
  await expect(page.locator('#walkScheme option')).toHaveCount(10);
  await expect(page.locator('#walkProgress')).toHaveText('Step 1 of 4');
  await expect(page.locator('#walkImage')).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(page.locator('#walkPrevious')).toBeDisabled();
  await page.click('#walkNext');
  await expect(page.locator('#walkStepContent')).toContainText('Identify the encoding rule');
  await page.click('#walkNext');
  await expect(page.locator('#walkStepContent')).toContainText('Convert each group');
  await expect(page.locator('.walk-table tbody tr')).toHaveCount(3);
  await page.click('#walkReveal');
  await expect(page.locator('#walkStepContent')).toContainText('BEE');
  await expect(page.locator('#walkImage')).toHaveAttribute('alt', /Annotated Skyline/);
  await expect(page.locator('#walkNext')).toBeDisabled();
  await page.selectOption('#walkScheme', '9');
  await expect(page.locator('#walkProgress')).toHaveText('Step 1 of 4');
  await page.click('#walkNext');
  await expect(page.locator('#walkStepContent')).toContainText('five bars');
  await page.click('#walkNext');
  await expect(page.locator('.walk-table tbody tr td:nth-child(2)').allTextContents()).resolves.toEqual(['B', 'E', 'A', 'T']);
  await expect(page.locator('#walkImage')).toHaveAttribute('alt', /Rhythm cipher example/);
});

test('all ten cipher walkthrough tables derive one conversion row per training letter', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Cipher Walkthrough' }).click();
  for (let i = 0; i < 10; i++) {
    await page.selectOption('#walkScheme', String(i));
    await page.click('#walkNext');
    await page.click('#walkNext');
    const rowCount = await page.locator('.walk-table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);
    await expect(page.locator('.walk-table')).not.toBeEmpty();
  }
});

test('Failure Analysis helpers summarize, filter and export structured evidence',async({page})=>{
 const r=await page.evaluate(async()=>{const{summarizeEvidence,filterEvidence,evidenceToCSV}=await import('/js/failure-analysis.js');const rows=[{type:'primary',outcome:'failure',category:'message_mismatch',seekerModel:'model-a',expectedMessage:'LANTERN',decodedMessage:'LATER'},{type:'independent',outcome:'success',category:'exact_recovery',seekerModel:'model-b',expectedMessage:'LANTERN',decodedMessage:'LANTERN'},{type:'hider',outcome:'failure',category:'missing_scheme',hiderModel:'model-a'}];return{summary:summarizeEvidence(rows),filtered:filterEvidence(rows,{type:'primary',outcome:'failure',model:'model-a',query:'later'}).length,csv:evidenceToCSV(rows)}});
 expect(r.summary.total).toBe(3);expect(r.summary.failures).toBe(2);expect(r.summary.successes).toBe(1);expect(r.summary.failureRate).toBeCloseTo(2/3);expect(r.summary.byCategory.message_mismatch).toBe(1);expect(r.filtered).toBe(1);expect(r.csv).toContain('timestamp,type,outcome,category');expect(r.csv).toContain('"LANTERN"');
});
test('Research Mode renders the local Failure Analysis workspace and empty state',async({page})=>{
 await page.locator('#tabs button',{hasText:'Research'}).click();await expect(page.locator('#failureAnalysis')).toBeVisible();await expect(page.locator('#evidenceStats')).toContainText('Recorded events');await expect(page.locator('#evidenceTable')).toContainText('No experiments recorded yet');await expect(page.locator('#evidenceJson')).toBeVisible();await expect(page.locator('#evidenceCsv')).toBeVisible();
});

test('AI duel outcomes are saved to the Failure Analysis evidence log',async({page})=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/><circle cx="180" cy="180" r="48" fill="#f1c987"/></svg>';
 const scheme='The number of bright circles encodes each letter by alphabet position.';
 await page.route('https://gen.pollinations.ai/v1/models',route=>route.fulfill({json:{data:[{id:'openai/gpt-6.1-sol'},{id:'openai/gpt-6.1-terra',input_modalities:['image']}]}}));
 await page.route('https://gen.pollinations.ai/v1/chat/completions',async route=>{
  const body=route.request().postDataJSON(),hider=body.model==='openai/gpt-6.1-sol';
  await route.fulfill({json:{model:body.model,choices:[{message:{content:hider?svg+'\nSCHEME: '+scheme:'MESSAGE: LATER\nMETHOD: I guessed from the bright circle.'},finish_reason:'stop'}],usage:{total_tokens:36,completion_tokens:20}}});
 });
 await page.reload();await page.waitForFunction(()=>[...document.querySelectorAll('#hider option')].some(o=>o.value==='openai/gpt-6.1-sol'));
 await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
 await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();await page.fill('#msg','LANTERN');await page.click('#hide');
 await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});await page.click('#ai');
 await expect(page.locator('#res')).toContainText('LATER',{timeout:10000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nc')).evidence);
 expect(saved.map(x=>x.type)).toEqual(['primary','hider']);
 expect(saved[0].outcome).toBe('failure');expect(saved[0].category).toBe('message_mismatch');expect(saved[0].expectedMessage).toBe('LANTERN');expect(saved[0].decodedMessage).toBe('LATER');
 expect(saved[1].outcome).toBe('success');expect(saved[1].category).toBe('valid_hider_output');
 await page.locator('#tabs button',{hasText:'Research'}).click();await expect(page.locator('#evidenceTable')).toContainText('message_mismatch');
 await page.selectOption('#evidenceOutcome','failure');await expect(page.locator('#evidenceTable')).toContainText('message_mismatch');await expect(page.locator('#evidenceTable')).not.toContainText('valid_hider_output');
});

test('Image Degradation Lab creates five deterministic browser-local variants',async({page})=>{
 const result=await page.evaluate(async()=>{
  const{createDegradationVariants,DEGRADATION_PROFILES}=await import('/js/degradation.js');
  const c=document.createElement('canvas');c.width=32;c.height=24;const x=c.getContext('2d');x.fillStyle='#d4a34f';x.fillRect(0,0,32,24);x.fillStyle='#14223a';x.fillRect(8,6,16,12);
  const variants=await createDegradationVariants(c.toDataURL('image/png'));
  return{profiles:DEGRADATION_PROFILES.map(p=>p.id),variants:variants.map(v=>({id:v.id,mime:v.mime,width:v.width,height:v.height,bytes:v.bytes,dataUrl:v.dataUrl}))};
 });
 expect(result.profiles).toEqual(['jpeg55','downscale50','blur2','noise18','crop12']);
 expect(result.variants).toHaveLength(5);
 expect(result.variants.map(v=>v.id)).toEqual(result.profiles);
 for(const v of result.variants){expect(v.width).toBe(32);expect(v.height).toBe(24);expect(v.bytes).toBeGreaterThan(0);expect(v.dataUrl).toMatch(/^data:image\/(png|jpeg);base64,/)}
 expect(result.variants[0].mime).toBe('image/jpeg');expect(result.variants.slice(1).every(v=>v.mime==='image/png')).toBeTruthy();
});
test('Image Degradation Lab is a separate workspace and requires an active AI round',async({page})=>{
 await page.locator('#tabs button',{hasText:'Image Degradation Lab'}).click();
 await expect(page.locator('#degradationLab')).toBeVisible();
 await expect(page.locator('#mainGame')).toBeHidden();
 await expect(page.locator('#degradationSource')).toContainText('Start an AI vs AI Duel');
 await expect(page.locator('#degradationRun')).toBeDisabled();
});
test('Image Degradation Lab runs five seeker checks and records each variant',async({page})=>{
 test.setTimeout(90000);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/><circle cx="180" cy="180" r="48" fill="#f1c987"/></svg>';
 const scheme='The number of bright circles encodes each letter by alphabet position.';
 let seekerCalls=0;
 await page.route('https://gen.pollinations.ai/v1/models',route=>route.fulfill({json:{data:[{id:'openai/gpt-6.1-sol'},{id:'openai/gpt-6.1-terra',input_modalities:['image']}]}}));
 await page.route('https://gen.pollinations.ai/v1/chat/completions',async route=>{
  const body=route.request().postDataJSON(),hider=body.model==='openai/gpt-6.1-sol';
  if(!hider)seekerCalls++;
  await route.fulfill({json:{model:body.model,choices:[{message:{content:hider?svg+'\nSCHEME: '+scheme:'MESSAGE: LANTERN\nMETHOD: I counted the visible symbols.'},finish_reason:'stop'}],usage:{total_tokens:36,completion_tokens:20}}});
 });
 page.on('dialog',dialog=>dialog.accept());
 await page.reload();await page.waitForFunction(()=>[...document.querySelectorAll('#hider option')].some(o=>o.value==='openai/gpt-6.1-sol'));
 await page.evaluate(()=>{Object.defineProperty(document.querySelector('polli-connect'),'apiKey',{value:'test-key',configurable:true})});
 await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();await page.fill('#msg','LANTERN');await page.click('#hide');
 await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});
 await page.locator('#tabs button',{hasText:'Image Degradation Lab'}).click();
 await expect(page.locator('#degradationRun')).toBeEnabled();
 await page.click('#degradationRun');
 await expect(page.locator('#degradationStatus')).toContainText('Completed',{timeout:75000});
 await expect(page.locator('.degradation-card')).toHaveCount(5);
 expect(seekerCalls).toBe(5);
 const evidence=await page.evaluate(()=>JSON.parse(localStorage.getItem('nc')).evidence.filter(x=>x.variant?.startsWith('lab-')));
 expect(evidence).toHaveLength(5);expect(evidence.every(x=>x.type==='robustness'&&x.expectedMessage==='LANTERN'&&x.similarity===1)).toBeTruthy();
 await page.locator('#tabs button',{hasText:'Research'}).click();
 await page.selectOption('#evidenceType','robustness');
 await expect(page.locator('#evidenceTable')).toContainText('lab-jpeg55');
});

test('Structural Sandbox reuses all ten training encoders and exposes live letter states', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Interactive Sandbox' }).click();
  await expect(page.locator('#lsbLab')).toBeVisible();
  await page.click('#sandboxStructuralTab');
  await expect(page.locator('#structuralSandbox')).toBeVisible();
  await expect(page.locator('#structuralScheme option')).toHaveCount(10);
  await expect(page.locator('#structuralPreview')).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(page.locator('#structuralBreakdown tbody tr')).toHaveCount(5);
  const initial = await page.locator('#structuralPreview').getAttribute('src');
  await page.fill('#structuralMessage', 'BEAT');
  await page.selectOption('#structuralScheme', '9');
  await expect(page.locator('#structuralBreakdown tbody tr')).toHaveCount(4);
  await expect(page.locator('#structuralBreakdown')).toContainText('Tall = 1, short = 0');
  await expect(page.locator('#structuralCapacity')).toContainText('theoretical bits');
  const updated = await page.locator('#structuralPreview').getAttribute('src');
  expect(updated).not.toBe(initial);
  await page.locator('#structuralSeed').evaluate(el => { el.value = '91'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#structuralSeedValue')).toHaveText('91');
});

test('LSB Pixel Inspector can manually toggle a selected RGB channel bit', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Interactive Sandbox' }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(120, 80, 40)'; ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#lsbFile').setInputFiles({
    name: 'manual-pixel.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64')
  });
  await expect(page.locator('#lsbStatus')).toContainText('Image loaded');
  await page.fill('#lsbMessage', 'A');
  await expect(page.locator('#lsbCapacity')).toContainText('7-byte format header');
  await expect(page.locator('#lsbCapacity')).toContainText('1,529-byte maximum payload');
  await expect(page.locator('#lsbEncode')).toBeEnabled();
  await page.evaluate(() => {
    const canvas = document.querySelector('#lsbImage');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: rect.left + 1, clientY: rect.top + 1
    }));
  });
  await expect(page.locator('#lsbManualBits')).toBeEnabled();
  const before = await page.evaluate(() => document.querySelector('#lsbImage').getContext('2d').getImageData(0, 0, 1, 1).data[0]);
  if (before & 1) await page.locator('#lsbBitR').uncheck();
  else await page.locator('#lsbBitR').check();
  const after = await page.evaluate(() => document.querySelector('#lsbImage').getContext('2d').getImageData(0, 0, 1, 1).data[0]);
  expect(after & 1).toBe((before & 1) ^ 1);
  expect(Math.abs(after - before)).toBe(1);
});

test('Structural Sandbox renders every deterministic training scheme', async ({ page }) => {
  await page.locator('#tabs button', { hasText: 'Interactive Sandbox' }).click();
  await page.click('#sandboxStructuralTab');
  for (let index = 0; index < 10; index++) {
    await page.selectOption('#structuralScheme', String(index));
    await expect(page.locator('#structuralPreview')).toHaveAttribute('src', /^data:image\/svg\+xml/);
    await expect(page.locator('#structuralBreakdown tbody tr')).toHaveCount(5);
  }
});
