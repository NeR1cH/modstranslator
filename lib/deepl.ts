// ============================================================
// BLOCK: DeepL API client  (SERVER-SIDE ONLY)
// API key is read exclusively from process.env.DEEPL_API_KEY
// NEVER import this file from client components
// ============================================================

import { getRateLimiter } from './rateLimiter';
import { getTranslationCache } from './translationCache';
import { getFragmentCache } from './fragmentCache';
import { fetchWithTimeout } from './security';
import { createLogger } from './logger';
import { ApiError, RateLimitError, QuotaExceededError, AuthError } from './errors';

const logger = createLogger('deepl');

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
  logger.debug('API tier:', isFree ? 'FREE' : 'PRO');
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
  logger.debug(`translateBatch attempt ${attempt}, texts count:`, texts.length);
  const url = getApiUrl(apiKey);
  logger.debug('API URL:', url);

  const params = new URLSearchParams();
  params.append('target_lang', 'RU');
  params.append('source_lang', 'EN');

  // Preserve Minecraft format codes like §6, %s, %d, {0} during translation
  params.append('tag_handling', 'xml');
  params.append('ignore_tags', 'keep');

  texts.forEach(t => params.append('text', t));
  logger.debug('Request params size:', params.toString().length, 'bytes');

  logger.debug('Sending request...');
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }, 30000); // 30 second timeout

  logger.debug('Response status:', res.status);

  if (res.status === 429) {
    logger.warn('Rate limit hit (429)');
    if (attempt < RETRY_LIMIT) {
      const delay = RETRY_DELAY_MS * attempt;
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return translateBatch(texts, apiKey, attempt + 1);
    }
    throw new RateLimitError('Превышен лимит запросов DeepL API. Попробуйте позже или проверьте остаток символов на deepl.com/account/usage');
  }

  if (res.status === 456) {
    logger.error('Quota exceeded (456)');
    throw new QuotaExceededError('Исчерпан лимит символов DeepL API. Проверьте ваш план на deepl.com/account/usage');
  }

  if (res.status === 403) {
    logger.error('Authentication failed (403)');
    throw new AuthError('Неверный API ключ DeepL. Проверьте DEEPL_API_KEY в файле .env');
  }

  if (res.status >= 500) {
    logger.error('Server error:', res.status);
    if (attempt < RETRY_LIMIT) {
      const delay = RETRY_DELAY_MS * attempt;
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return translateBatch(texts, apiKey, attempt + 1);
    }
    throw new ApiError(`Сервер DeepL временно недоступен (ошибка ${res.status}). Попробуйте позже`, res.status);
  }

  if (!res.ok) {
    const body = await res.text();
    logger.error('API error:', res.status, body);
    throw new ApiError(`Ошибка DeepL API (${res.status}): ${body}`, res.status);
  }

  const data = await res.json() as {
    translations: Array<{ text: string }>;
  };

  logger.debug('Translations received:', data.translations.length);
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
  logger.info('translateTexts called, total texts:', texts.length);

  if (texts.length === 0) {
    logger.debug('No texts to translate, returning empty array');
    return [];
  }

  // Get rate limiter (handles multiple keys)
  const rateLimiter = getRateLimiter();
  const apiKey = rateLimiter.getCurrentKey();
  logger.debug('Using API key:', apiKey ? '***' : 'NOT SET');

  if (!apiKey) {
    logger.error('API key not found');
    throw new AuthError('DEEPL_API_KEY не задан в .env файле');
  }

  // Step 1: Check full translation cache first
  const cache = getTranslationCache();
  const fragmentCache = getFragmentCache();
  const cachedTranslations = cache.getMany(texts);

  // Step 2: Try fragment cache for uncached texts
  const uncachedTexts: string[] = [];
  const fragmentTranslations = new Map<string, string>();

  for (const text of texts) {
    if (cachedTranslations.has(text)) continue;

    // Try fragment cache
    const fragmentResult = fragmentCache.tryTranslate(text);
    if (fragmentResult) {
      fragmentTranslations.set(text, fragmentResult);
      // Cache fragment result for future use
      cache.set(text, fragmentResult);
    } else {
      uncachedTexts.push(text);
    }
  }

  logger.info(`Cache stats: ${cachedTranslations.size} full cache hits, ${fragmentTranslations.size} fragment hits, ${uncachedTexts.length} API calls needed`);

  // Step 3: If everything is cached/fragmented, return immediately
  if (uncachedTexts.length === 0) {
    logger.info('All translations found in cache/fragments, skipping DeepL API call');
    return texts.map(t => cachedTranslations.get(t) || fragmentTranslations.get(t)!);
  }

  // Step 4: Calculate total characters for uncached texts only
  const totalChars = uncachedTexts.join('').length;
  logger.info('Characters to translate via DeepL API (uncached):', totalChars);

  // Step 5: Check rate limit before making API calls
  await rateLimiter.checkLimit(totalChars);

  // Get current API key (may have switched during checkLimit)
  const currentApiKey = rateLimiter.getCurrentKey();

  // Step 6: Translate uncached texts via DeepL API
  const batches = chunk(uncachedTexts, BATCH_SIZE);
  logger.info('Split into batches:', batches.length);

  const newTranslations: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    logger.debug(`Processing batch ${i + 1}/${batches.length}, size: ${batch.length}`);
    const translated = await translateBatch(batch, currentApiKey);
    newTranslations.push(...translated);
    logger.debug(`Batch ${i + 1} complete, total results so far: ${newTranslations.length}`);
  }

  // Step 7: Record usage after successful translation
  rateLimiter.recordUsage(totalChars);

  // Step 8: Cache new translations
  const translationPairs = uncachedTexts.map((original, i) => ({
    original,
    translated: newTranslations[i]
  }));
  cache.setMany(translationPairs);

  // Step 9: Learn fragments from new translations for future reuse
  translationPairs.forEach(({ original, translated }) => {
    fragmentCache.learn(original, translated);
  });

  // Step 10: Combine cached, fragment, and new translations in correct order
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

  logger.info('All translations complete, total results:', results.length);
  return results;
}
