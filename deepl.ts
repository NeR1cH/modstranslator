// ============================================================
// BLOCK: DeepL API client  (SERVER-SIDE ONLY)
// API key is read exclusively from process.env.DEEPL_API_KEY
// NEVER import this file from client components
// ============================================================

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
  return key.trim().endsWith(':fx') ? DEEPL_FREE_URL : DEEPL_PRO_URL;
}

// ============================================================
// BLOCK: Single batch request with retry logic
// ============================================================
async function translateBatch(
  texts: string[],
  apiKey: string,
  attempt = 1
): Promise<string[]> {
  const url = getApiUrl(apiKey);

  const params = new URLSearchParams();
  params.append('target_lang', 'RU');
  params.append('source_lang', 'EN');

  // Preserve Minecraft format codes like §6, %s, %d, {0} during translation
  params.append('tag_handling', 'xml');
  params.append('ignore_tags', 'keep');

  texts.forEach(t => params.append('text', t));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt < RETRY_LIMIT) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return translateBatch(texts, apiKey, attempt + 1);
    }
    throw new Error(`DeepL HTTP ${res.status} после ${RETRY_LIMIT} попыток`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepL ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    translations: Array<{ text: string }>;
  };

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
// Handles batching + validates API key presence
// ============================================================
export async function translateTexts(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error('DEEPL_API_KEY не задан в .env файле');

  const results: string[] = [];
  for (const batch of chunk(texts, BATCH_SIZE)) {
    const translated = await translateBatch(batch, apiKey);
    results.push(...translated);
  }

  return results;
}
