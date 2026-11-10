import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('test-results/blind-seeker');
const KEY = path.join(ROOT, 'private', 'answer-key.json');
const RESULTS = path.join(ROOT, 'seeker-results.jsonl');
const OUTPUT = path.join(ROOT, 'scored-report.json');

const normalize = value => String(value ?? '').toUpperCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^A-Z]/g, '');
function editDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}
export function scoreCharacterAccuracy(expected, decoded) {
  const a = normalize(expected), b = normalize(decoded);
  return 1 - editDistance(a, b) / Math.max(1, a.length, b.length);
}
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const key = JSON.parse(await readFile(KEY, 'utf8'));
const records = (await readFile(RESULTS, 'utf8')).split(/\\r?\\n/).filter(Boolean).map(line => JSON.parse(line)).filter(row => row.trialId);
const byId = new Map();
for (const record of records) byId.set(record.trialId, record);
const rows = key.trials.map(answer => {
  const result = byId.get(answer.trialId);
  if (!result) return { ...answer, status: 'not_attempted', exact: false, characterAccuracy: 0, durationMs: null };
  const valid = result.status === 'completed';
  const decoded = valid ? normalize(result.decodedMessage) : '';
  const expected = normalize(answer.expectedMessage);
  const accuracy = valid ? scoreCharacterAccuracy(expected, decoded) : 0;
  return {
    ...answer,
    status: result.status,
    exact: valid && decoded === expected,
    characterAccuracy: accuracy,
    durationMs: result.durationMs ?? null,
    responseModel: result.responseModel || null,
    usage: result.usage || null,
    decodedMessage: result.decodedMessage ?? null,
    error: result.error || null
  };
});
const groupBy = (field, extra) => {
  const groups = new Map();
  for (const row of rows) {
    const id = [row[field], ...(extra || []).map(k => row[k])].join('||');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups.values()].map(group => {
    const attempted = group.filter(row => row.status !== 'not_attempted');
    const completed = attempted.filter(row => row.status === 'completed');
    const latencies = attempted.map(row => row.durationMs).filter(Number.isFinite);
    const failed = attempted.filter(row => ['request_error', 'timeout', 'parse_error'].includes(row.status));
    return {
      [field]: group[0][field],
      ...(extra || []).reduce((acc, k) => (acc[k] = group[0][k], acc), {}),
      n: group.length,
      attempted: attempted.length,
      exactRecoveries: completed.filter(row => row.exact).length,
      exactRecoveryRate: completed.length ? completed.filter(row => row.exact).length / completed.length : null,
      meanCharacterAccuracy: completed.length ? mean(completed.map(row => row.characterAccuracy)) : null,
      meanLatencyMs: mean(latencies),
      medianLatencyMs: percentile(latencies, .5),
      p95LatencyMs: percentile(latencies, .95),
      requestOrParseFailures: failed.length,
      failureRate: attempted.length ? failed.length / attempted.length : null,
      noneResponses: completed.filter(row => normalize(row.decodedMessage) === '').length
    };
  });
};
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  model: records.find(row => row.model)?.model || 'unknown',
  promptSha256: records.find(row => row.promptSha256)?.promptSha256 || null,
  attempted: rows.filter(row => row.status !== 'not_attempted').length,
  total: rows.length,
  definitions: {
    exactRecoveryRate: 'Exact matches / completed model responses; NONE is a valid miss, not an API failure.',
    characterAccuracy: '1 - Levenshtein distance / max(expected length, decoded length); request and parse failures score 0.',
    failureRate: 'Request, timeout and response-parse failures / attempted requests. NONE is excluded.',
    latency: 'Median and p95 over all attempted requests with a measured duration.'
  },
  byCipher: groupBy('cipher'),
  byCipherAndVariant: groupBy('cipher', ['variant']),
  byCipherLengthAndVariant: groupBy('cipher', ['length', 'variant']),
  trials: rows
};
await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\\n');
console.log('Wrote ' + OUTPUT);
console.log(JSON.stringify({ attempted: report.attempted, total: report.total, byCipher: report.byCipher }, null, 2));
