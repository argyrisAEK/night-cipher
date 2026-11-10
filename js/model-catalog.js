const CATALOG_URL = 'https://gen.pollinations.ai/text/models?reliability=all';
const MODEL_PRICE_KEYS = Object.freeze({
  promptTextTokens: 'Input',
  completionTextTokens: 'Output',
  promptCachedTokens: 'Cached input'
});

const asArray = payload => Array.isArray(payload) ? payload
  : Array.isArray(payload?.data) ? payload.data
  : Array.isArray(payload?.models) ? payload.models
  : [];

export async function loadModelCatalog(fetcher = fetch) {
  const response = await fetcher(CATALOG_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Model catalog request failed (${response.status}).`);
  const rows = asArray(await response.json());
  const catalog = new Map();
  for (const model of rows) {
    if (!model || typeof model.id !== 'string') continue;
    catalog.set(model.id, model);
    for (const alias of Array.isArray(model.aliases) ? model.aliases : []) {
      if (typeof alias === 'string' && !catalog.has(alias)) catalog.set(alias, model);
    }
  }
  return catalog;
}

export function getModelMetadata(catalog, id) {
  return catalog instanceof Map ? catalog.get(id) || null : null;
}

export function modelSupportsVision(model) {
  return !!(model && (
    (Array.isArray(model.input_modalities) && model.input_modalities.includes('image')) ||
    Number(model.max_reference_images) > 0
  ));
}

const rateFor = (model, key) => {
  const pricing = model?.pricing && typeof model.pricing === 'object' ? model.pricing : model;
  const value = Number(pricing?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const formatRate = value => {
  const perMillion = value * 1_000_000;
  return Number(perMillion.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
};

export function describeModel(model, { requiresVision = false } = {}) {
  if (!model) return 'Live catalog details are unavailable. Pricing and capabilities could not be verified.';
  const publisher = model.publisher || model.brand || 'Not listed';
  const modalities = Array.isArray(model.input_modalities) ? model.input_modalities.join(', ') : '';
  const capability = requiresVision
    ? (modelSupportsVision(model) ? 'Vision input: supported' : modalities ? 'Vision input: not listed' : 'Vision input: unverified')
    : (modalities ? `Input modalities: ${modalities}` : 'Input modalities: not listed');
  const prices = Object.entries(MODEL_PRICE_KEYS)
    .map(([key, label]) => {
      const rate = rateFor(model, key);
      return rate == null ? null : `${label} ${formatRate(rate)} Pollen / 1M tokens`;
    })
    .filter(Boolean);
  const priceText = prices.length ? prices.join(' · ') : 'Token pricing: not published';
  const health = model.health?.status ? `Availability: ${model.health.status}` : '';
  return [`Publisher: ${publisher}`, capability, priceText, health].filter(Boolean).join(' · ');
}

export function estimatePollenCost(model, usage) {
  if (!model || !usage) return null;
  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  const cachedTokens = Number(usage.prompt_tokens_details?.cached_tokens || 0);
  const inputRate = rateFor(model, 'promptTextTokens');
  const outputRate = rateFor(model, 'completionTextTokens');
  const cachedRate = rateFor(model, 'promptCachedTokens');
  const uncachedInput = Math.max(0, promptTokens - cachedTokens);
  if ((uncachedInput > 0 && inputRate == null) || (completionTokens > 0 && outputRate == null) || (cachedTokens > 0 && cachedRate == null)) return null;
  return uncachedInput * (inputRate || 0) + completionTokens * (outputRate || 0) + cachedTokens * (cachedRate || 0);
}

export function formatPollenCost(value) {
  if (!Number.isFinite(Number(value))) return 'Unavailable';
  return `${Number(value).toFixed(6).replace(/0+$/, '').replace(/[.]$/, '')} Pollen (estimate)`;
}
