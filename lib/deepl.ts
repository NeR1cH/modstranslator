// ============================================================
// BLOCK: DeepL API client  (SERVER-SIDE ONLY)
// API key is read exclusively from process.env.DEEPL_API_KEY
// NEVER import this file from client components
// ============================================================

import { getRateLimiter } from './rateLimiter';
import { getTranslationCache } from './translationCache';
import { getFragmentCache } from './fragmentCache';
import { fetchWithTimeout } from './security';

const DEEPL_FREE_URL  = 'https://api-free.deepl.com/v2/translate';
const DEEPL_PRO_URL   = 'https://api.deepl.com/v2/translate';
const BATCH_SIZE      = 50;   // DeepL max texts per request
const RETRY_LIMIT     = 3;
const RETRY_DELAY_MS  = 1000;

// ============================================================
// BLOCK: Detect whether key is Free or Pro tier
// Free keys end with :fx
// ============================================================
function getApiUrl(key: string): string {
  const isFree = key.trim().endsWith(':fx');
  console.log('[deepl] API tier:', isFree ? 'FREE' : 'PRO');
  return isFree ? DEEPL_FREE_URL : DEEPL_PRO_URL;
}

// ============================================================
// BLOCK: Single batch request with retry logic
// ============================================================
async function translateBatch(
  texts: string[],
  apiKey: string,
  attempt = 1
): Promise<string[]> {
  console.log(`[deepl] translateBatch attempt ${attempt}, texts count:`, texts.length);
  const url = getApiUrl(apiKey);
  console.log('[deepl] API URL:', url);

  const params = new URLSearchParams();
  params.append('target_lang', 'RU');
  params.append('source_lang', 'EN');

  // Preserve Minecraft format codes like §6, %s, %d, {0} during translation
  params.append('tag_handling', 'xml');
  params.append('ignore_tags', 'keep');

  texts.forEach(t => params.append('text', t));
  console.log('[deepl] Request params size:', params.toString().length, 'bytes');

  console.log('[deepl] Sending request...');
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }, 30000); // 30 second timeout

  console.log('[deepl] Response status:', res.status);

  if (res.status === 429) {
    console.warn('[deepl] Rate limit hit (429)');
    if (attempt < RETRY_LIMIT) {
      const delay = RETRY_DELAY_MS * attempt;
      console.log(`[deepl] Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return translateBatch(texts, apiKey, attempt + 1);
    }
    throw new Error('Превышен лимит запросов DeepL API. Попробуйте позже или проверьте остаток символов на deepl.com/account/usage');
  }

  if (res.status === 456) {
    console.error('[deepl] Quota exceeded (456)');
    throw new Error('Исчерпан лимит символов DeepL API. Проверьте ваш план на deepl.com/account/usage');
  }

  if (res.status === 403) {
    console.error('[deepl] Authentication failed (403)');
    throw new Error('Неверный API ключ DeepL. Проверьте DEEPL_API_KEY в файле .env');
  }

  if (res.status >= 500) {
    console.error('[deepl] Server error:', res.status);
    if (attempt < RETRY_LIMIT) {
      const delay = RETRY_DELAY_MS * attempt;
      console.log(`[deepl] Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return translateBatch(texts, apiKey, attempt + 1);
    }
    throw new Error(`Сервер DeepL временно недоступен (ошибка ${res.status}). Попробуйте позже`);
  }

  if (!res.ok) {
    const body = await res.text();
    console.error('[deepl] API error:', res.status, body);
    throw new Error(`Ошибка DeepL API (${res.status}): ${body}`);
  }

  const data = await res.json() as {
    translations: Array<{ text: string }>;
  };

  console.log('[deepl] Translations received:', data.translations.length);
  return data.translations.map(t => t.text);
}

// ============================================================
// BLOCK: Chunk helper
// ============================================================
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================
// BLOCK: Public translation function
// Handles batching + validates API key presence + rate limiting + caching
// ============================================================
export async function translateTexts(texts: string[]): Promise<string[]> {
  console.log('\n[deepl] translateTexts called');
  console.log('[deepl] Total texts to translate:', texts.length);

  if (texts.length === 0) {
    console.log('[deepl] No texts to translate, returning empty array');
    return [];
  }

  const apiKey = process.env.DEEPL_API_KEY;
  console.log('[deepl] API key present:', !!apiKey);
  console.log('[deepl] API key length:', apiKey?.length || 0);

  if (!apiKey) {
    console.error('[deepl] API key not found in environment');
    throw new Error('DEEPL_API_KEY не задан в .env файле');
  }

  // Check cache first
  const cache = getTranslationCache();
  const fragmentCache = getFragmentCache();
  const cachedTranslations = cache.getMany(texts);

  // Try fragment cache for uncached texts
  const uncachedTexts: string[] = [];
  const fragmentTranslations = new Map<string, string>();

  for (const text of texts) {
    if (cachedTranslations.has(text)) continue;

    // Try fragment cache
    const fragmentResult = fragmentCache.tryTranslate(text);
    if (fragmentResult) {
      fragmentTranslations.set(text, fragmentResult);
    } else {
      uncachedTexts.push(text);
    }
  }

  console.log(`[deepl] Cache stats: ${cachedTranslations.size} full cache hits, ${fragmentTranslations.size} fragment hits, ${uncachedTexts.length} misses`);

  // If everything is cached, return immediately
  if (uncachedTexts.length === 0) {
    console.log('[deepl] All translations found in cache/fragments, skipping API call');
    return texts.map(t => cachedTranslations.get(t) || fragmentTranslations.get(t)!);
  }

  // Calculate total characters for uncached texts only
  const totalChars = uncachedTexts.join('').length;
  console.log('[deepl] Characters to translate (uncached):', totalChars);

  // Check rate limit before making API calls
  const rateLimiter = getRateLimiter();
  await rateLimiter.checkLimit(totalChars);

  // Translate uncached texts
  const batches = chunk(uncachedTexts, BATCH_SIZE);
  console.log('[deepl] Split into batches:', batches.length);

  const newTranslations: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`[deepl] Processing batch ${i + 1}/${batches.length}, size: ${batch.length}`);
    const translated = await translateBatch(batch, apiKey);
    newTranslations.push(...translated);
    console.log(`[deepl] Batch ${i + 1} complete, total results so far: ${newTranslations.length}`);
  }

  // Record usage after successful translation
  rateLimiter.recordUsage(totalChars);

  // Cache new translations
  const translationPairs = uncachedTexts.map((original, i) => ({
    original,
    translated: newTranslations[i]
  }));
  cache.setMany(translationPairs);

  // Learn fragments from new translations
  translationPairs.forEach(({ original, translated }) => {
    fragmentCache.learn(original, translated);
  });

  // Combine cached, fragment, and new translations in correct order
  const results: string[] = [];
  let uncachedIndex = 0;

  for (const text of texts) {
    if (cachedTranslations.has(text)) {
      results.push(cachedTranslations.get(text)!);
    } else if (fragmentTranslations.has(text)) {
      results.push(fragmentTranslations.get(text)!);
    } else {
      results.push(newTranslations[uncachedIndex++]);
    }
  }

  console.log('[deepl] All translations complete, total results:', results.length);
  return results;
}
