import { createHash } from 'node:crypto';
import { mkdir, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { SEEK } from '../js/api.js';

const ROOT = path.resolve('test-results/blind-seeker');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PRIVATE_KEY = path.join(ROOT, 'private', 'answer-key.json');
const RESULTS = path.join(ROOT, 'seeker-results.jsonl');
const MODEL = 'openai/gpt-6.1-terra';
const API = 'https://gen.pollinations.ai/v1/chat/completions';
const MAX_TOKENS = 4000;
const TIMEOUT_MS = 90_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function argsOf(argv) {
  const out = { limit: Infinity, delay: 350, confirmPaid: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') out.limit = Number(argv[++i]);
    else if (argv[i] === '--delay-ms') out.delay = Number(argv[++i]);
    else if (argv[i] === '--confirm-paid') out.confirmPaid = true;
    else throw new Error('Unknown argument: ' + argv[i]);
  }
  if (!(out.limit > 0) || !Number.isInteger(out.limit) && out.limit !== Infinity) throw new Error('--limit must be a positive integer.');
  if (!Number.isInteger(out.delay) || out.delay < 0 || out.delay > 10000) throw new Error('--delay-ms must be 0–10000.');
  return out;
}

function parseMessage(text) {
  const match = String(text ?? '').match(/^MESSAGE:\s*(.*)$/im);
  if (!match) throw new Error('seeker_response_parse_error: missing MESSAGE line');
  const message = match[1].trim();
  const method = (String(text).match(/^METHOD:\s*(.*)$/im) || [])[1]?.trim() || '';
  return { message, method };
}

async function request(imagePath, apiKey) {
  const bytes = await readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const imageUrl = 'data:' + mime + ';base64,' + bytes.toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: [
          { type: 'text', text: SEEK },
          { type: 'image_url', image_url: { url: imageUrl } }
        ] }]
      }),
      signal: controller.signal
    });
    const durationMs = Math.round(performance.now() - started);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { status: 'request_error', durationMs, httpStatus: response.status, error: body.slice(0, 1000) };
    }
    const json = await response.json();
    const rawResponse = json.choices?.[0]?.message?.content;
    const text = Array.isArray(rawResponse) ? rawResponse.map(part => part.text || '').join('') : String(rawResponse ?? '');
    let parsed;
    try { parsed = parseMessage(text); }
    catch (error) {
      return { status: 'parse_error', durationMs, responseModel: json.model || MODEL, finishReason: json.choices?.[0]?.finish_reason || null, usage: json.usage || null, rawResponse: text, error: error.message };
    }
    return {
      status: 'completed',
      durationMs,
      responseModel: json.model || MODEL,
      finishReason: json.choices?.[0]?.finish_reason || null,
      usage: json.usage || null,
      decodedMessage: parsed.message,
      method: parsed.method,
      rawResponse: text
    };
  } catch (error) {
    return {
      status: error.name === 'AbortError' ? 'timeout' : 'request_error',
      durationMs: Math.round(performance.now() - started),
      error: error.name === 'AbortError' ? 'Request timed out after ' + TIMEOUT_MS + ' ms' : String(error.message || error)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const options = argsOf(process.argv.slice(2));
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) throw new Error('Set POLLINATIONS_API_KEY in your local environment. Do not paste it into chat or commit it.');
  if (!options.confirmPaid) throw new Error('This sends paid vision requests. Review the dataset and rerun with --confirm-paid to authorize execution.');
  const manifest = JSON.parse(await readFile(path.join(PUBLIC_DIR, 'manifest.json'), 'utf8'));
  const answerKey = JSON.parse(await readFile(PRIVATE_KEY, 'utf8'));
  if (manifest.trialCount !== 200 || manifest.trials.length !== 200 || answerKey.trials.length !== 200) {
    throw new Error('Expected exactly 200 public trials and 200 evaluator records. Regenerate the local dataset first.');
  }
  const answerIds = new Set(answerKey.trials.map(item => item.trialId));
  if (manifest.trials.some(item => !answerIds.has(item.trialId))) throw new Error('Public manifest and local answer key do not match.');
  const existing = new Set();
  try {
    for (const line of (await readFile(RESULTS, 'utf8')).split(/\r?\n/).filter(Boolean)) {
      try { existing.add(JSON.parse(line).trialId); } catch {}
    }
  } catch {}
  const todo = manifest.trials.filter(item => !existing.has(item.trialId)).slice(0, options.limit);
  const promptSha256 = createHash('sha256').update(SEEK).digest('hex');
  const runInfo = {
    type: 'run_metadata',
    timestamp: new Date().toISOString(),
    model: MODEL,
    promptSha256,
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    totalTrials: manifest.trialCount,
    pendingThisRun: todo.length,
    note: 'One isolated request per image; no answer-key fields are sent to the model.'
  };
  await mkdir(ROOT, { recursive: true });
  await appendFile(RESULTS, JSON.stringify(runInfo) + '\n');
  console.log(JSON.stringify(runInfo, null, 2));
  for (let i = 0; i < todo.length; i++) {
    const trial = todo[i];
    const result = await request(path.join(PUBLIC_DIR, trial.image), apiKey);
    const record = { trialId: trial.trialId, model: MODEL, promptSha256, attemptedAt: new Date().toISOString(), ...result };
    await appendFile(RESULTS, JSON.stringify(record) + '\n');
    console.log((i + 1) + '/' + todo.length + ' ' + trial.trialId + ' ' + result.status + ' ' + (result.durationMs ?? '—') + 'ms');
    if (i < todo.length - 1 && options.delay) await sleep(options.delay);
  }
  console.log('Saved checkpointed responses to ' + RESULTS);
  console.log('The answer key was used only for local consistency checks and was never sent to the Seeker.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
