import { test, expect } from '@playwright/test';
import { pickPlan, decodePlan, eligibleMethods } from '../server/encoding.mjs';
import hideHandler from '../api/hide.mjs';
import revealHandler from '../api/reveal.mjs';

test('server-only encoding planner round-trips without shipping a browser module', () => {
  const plan=pickPlan('LANTERN',{round:123});
  expect(decodePlan(plan)).toBe('LANTERN');
  expect(eligibleMethods('THE BEES KNOW THE WAY')).toContain('morse');
});

test('server Hider embeds a valid pattern and keeps its plan inside an encrypted reveal token', async () => {
  const previousSecret=process.env.NIGHT_CIPHER_ROUND_SECRET,previousFetch=global.fetch;
  process.env.NIGHT_CIPHER_ROUND_SECRET='test-only-round-secret-0123456789abcdef0123456789';
  global.fetch=async()=>({ok:true,json:async()=>({model:'mock-hider',choices:[{message:{content:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>'},finish_reason:'stop'}],usage:{total_tokens:9}})});
  const invoke=async(handler,body)=>{
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=value}};
    await handler({method:'POST',body},res);
    return {status:res.statusCode,...JSON.parse(res.body||'{}')};
  };
  try{
    const first=await invoke(hideHandler,{secret:'LANTERN',model:'mock-hider',pollinationsKey:'byop-test-key'});
    expect(first.status).toBe(200);
    expect(first.validation.encodingValid).toBe(true);
    expect(first.svg).toContain('<circle');
    expect(first.svg.toUpperCase()).not.toContain('LANTERN');
    expect(first).not.toHaveProperty('prompt');
    expect(first.revealToken).not.toContain('LANTERN');
    const reveal=await invoke(revealHandler,{revealToken:first.revealToken});
    expect(reveal.status).toBe(200);
    expect(reveal.message).toBe('LANTERN');
    expect(reveal.annotations).toHaveLength(7);
    const second=await invoke(hideHandler,{secret:'LANTERN',model:'mock-hider',pollinationsKey:'byop-test-key',previousRoundToken:first.revealToken});
    expect(second.status).toBe(200);
    const secondReveal=await invoke(revealHandler,{revealToken:second.revealToken});
    expect(secondReveal.method).not.toBe(reveal.method);
  }finally{
    global.fetch=previousFetch;
    if(previousSecret===undefined)delete process.env.NIGHT_CIPHER_ROUND_SECRET;else process.env.NIGHT_CIPHER_ROUND_SECRET=previousSecret;
  }
});

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

test('AI vs AI Duel uses the private Hider endpoint and keeps the encoding plan out of browser requests', async ({ page }) => {
  let hideBody=null,seekerPrompt='';
  const finalSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/><circle cx="200" cy="180" r="2" fill="#f1c987"/><circle cx="220" cy="190" r="2" fill="#f1c987"/></svg>';
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json: { data: [{ id: 'test-hider' }, { id: 'test-vision-seeker', input_modalities: ['image'] }] }
  }));
  await page.route('**/api/hide', async route => {
    hideBody=route.request().postDataJSON();
    await route.fulfill({json:{
      svg:finalSvg,revealToken:'opaque-encrypted-round-token',model:'test-hider',
      rawResponse:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>',
      validation:{svgValid:true,encodingValid:true,secretLeak:false},
      usage:{total_tokens:12},durationMs:42
    }});
  });
  await page.route('https://gen.pollinations.ai/v1/chat/completions', async route => {
    const body=route.request().postDataJSON();
    seekerPrompt=JSON.stringify(body.messages);
    await route.fulfill({json:{choices:[{message:{content:'MESSAGE: LANTERN\nMETHOD: I found a repeated pattern of tiny lights.'}}],usage:{total_tokens:12}}});
  });
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('#hider option')].some(option => option.value === 'test-hider'));
  await page.evaluate(() => { Object.defineProperty(document.querySelector('polli-connect'), 'apiKey', { value: 'test-key', configurable: true }); });
  await page.locator('#tabs button', { hasText: 'AI vs AI Duel' }).click();
  await page.fill('#msg', 'LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});
  expect(hideBody.secret).toBe('LANTERN');
  expect(hideBody.model).toBe('test-hider');
  expect(hideBody.pollinationsKey).toBe('test-key');
  expect(hideBody).not.toHaveProperty('method');
  expect(hideBody).not.toHaveProperty('groups');
  expect(hideBody).not.toHaveProperty('mapping');
  expect(hideBody).not.toHaveProperty('plan');
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('AI seeker said: “LANTERN”',{timeout:10000});
  expect(seekerPrompt).not.toContain('LANTERN');
  expect(await page.evaluate(async()=> (await fetch('/js/encoding.js')).status)).toBe(404);
  const log=await page.evaluate(()=>JSON.parse(localStorage.getItem('nc')).duelLog);
  expect(log.lastToken).toBe('opaque-encrypted-round-token');
});

test('AI Output Inspection captures server Hider output without exposing its private encoding plan', async ({ page }) => {
  const finalSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/><circle cx="200" cy="180" r="2" fill="#f1c987"/></svg>';
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json: { data: [{ id: 'diagnostic-hider' }, { id: 'diagnostic-seeker', input_modalities: ['image'] }] }
  }));
  await page.route('**/api/hide', route => route.fulfill({json:{
    svg:finalSvg,revealToken:'opaque-token',model:'diagnostic-hider',
    rawResponse:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>',
    validation:{svgValid:true,encodingValid:true,secretLeak:false},usage:{total_tokens:23},durationMs:30
  }}));
  await page.route('https://gen.pollinations.ai/v1/chat/completions', route => route.fulfill({json:{
    model:'diagnostic-seeker',
    choices:[{message:{content:'MESSAGE: LANTERN\nMETHOD: I counted the repeated lights.'},finish_reason:'stop'}],
    usage:{total_tokens:17,completion_tokens:12}
  }}));
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('#hider option')].some(o => o.value === 'diagnostic-hider'));
  await page.evaluate(() => { Object.defineProperty(document.querySelector('polli-connect'), 'apiKey', { value: 'test-key', configurable: true }); });
  await page.locator('#tabs button', {hasText:'AI vs AI Duel'}).click();
  await page.fill('#msg','LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});
  await expect(page.locator('#diagnosticsContent')).toContainText('diagnostic-hider');
  await expect(page.locator('#diagnosticsContent')).toContainText('Hider raw SVG');
  await page.click('#ai');
  await expect(page.locator('#diagnosticsContent')).toContainText('MESSAGE: LANTERN',{timeout:10000});
  await expect(page.locator('#diagnosticsContent')).toContainText('Encoding fidelity');
  await page.locator('#diagnostics > summary').click();
  const reportText=await page.locator('#diagnosticsContent details').last().locator('pre').textContent();
  const report=JSON.parse(reportText);
  expect(report.encoding.method).toBe('Server-side private plan');
  expect(report.encoding).not.toHaveProperty('expectedMessage');
  expect(report.hider.rawResponse).toContain('<svg');
  expect(report.hider.svg).toContain('<svg');
  expect(report.hider.validation.svgValid).toBe(true);
  expect(report.hider.validation.encodingValid).toBe(true);
  expect(report.seeker.decodedMessage).toBe('LANTERN');
  expect(report.result.exactMatch).toBe(true);
  expect(JSON.stringify(report)).not.toContain('test-key');
});

test('the Hider explanation is revealed only after an explicit user action', async ({ page }) => {
  const finalSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><rect width="800" height="500" fill="#11182b"/></svg>';
  await page.route('https://gen.pollinations.ai/v1/models', route => route.fulfill({
    json: { data: [{ id: 'reveal-hider' }, { id: 'reveal-seeker', input_modalities: ['image'] }] }
  }));
  await page.route('**/api/hide', route => route.fulfill({json:{
    svg:finalSvg,revealToken:'opaque-round-token',model:'reveal-hider',
    rawResponse:finalSvg,validation:{svgValid:true,encodingValid:true,secretLeak:false}
  }}));
  let revealBody=null;
  await page.route('**/api/reveal', async route => {
    revealBody=route.request().postDataJSON();
    await route.fulfill({json:{method:'Constellation counts',rule:'Each constellation contains a count of stars; A=1 through Z=26.',scene:'Night observatory',annotations:[{x:100,y:100,w:60,h:50,letter:'L'}]}});
  });
  await page.route('https://gen.pollinations.ai/v1/chat/completions', route => route.fulfill({json:{
    choices:[{message:{content:'MESSAGE: LANTERN\nMETHOD: Count the star clusters.'}}],usage:{total_tokens:5}
  }}));
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('#hider option')].some(o => o.value === 'reveal-hider'));
  await page.evaluate(() => { Object.defineProperty(document.querySelector('polli-connect'), 'apiKey', { value: 'test-key', configurable: true }); });
  await page.locator('#tabs button',{hasText:'AI vs AI Duel'}).click();
  await page.fill('#msg','LANTERN');
  await page.click('#hide');
  await expect(page.locator('#imgbox img')).toBeVisible({timeout:10000});
  await expect(page.locator('#imgbox img')).toHaveAttribute('alt','Puzzle picture');
  await expect(page.locator('#revealHow')).toBeHidden();
  await page.click('#ai');
  await expect(page.locator('#res')).toContainText('AI seeker said:',{timeout:10000});
  await expect(page.locator('#revealHow')).toBeVisible();
  await page.click('#revealHow');
  await expect(page.locator('#imgbox img')).toHaveAttribute('alt','Annotated hidden message');
  expect(revealBody.revealToken).toBe('opaque-round-token');
  await expect(page.locator('#res')).toContainText('Each constellation contains a count of stars');
});
