/**
 * OpenRouter API client for translation
 * Alternative to DeepL using LLM models
 */

interface TranslateOptions {
  targetLang?: string;
  preserveFormatting?: boolean;
  model?: string;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class OpenRouterTranslator {
  private apiKey: string;
  private model: string;
  private endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free';

    // Не бросаем ошибку здесь - проверим при первом вызове translate()
  }

  /**
   * Translate single text with retry logic for rate limits
   */
  async translate(
    text: string,
    options: TranslateOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not set in .env');
    }

    const {
      targetLang = 'Russian',
      preserveFormatting = true,
      model = this.model
    } = options;

    console.log(`🤖 [OpenRouter] Translating with model: ${model}`);
    console.log(`📝 [OpenRouter] Text length: ${text.length} chars`);

    const systemPrompt = this.buildSystemPrompt(targetLang, preserveFormatting);

    // Retry logic for rate limits
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();

        let response;
        try {
          response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://github.com/NeR1cH/modstranslator',
              'X-Title': 'MOD_TRANSLATOR'
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
              ]
            })
          });
        } catch (fetchError) {
          // Network error or fetch failure
          console.error(`❌ [OpenRouter] Fetch error (attempt ${attempt}/${MAX_RETRIES}):`, fetchError);

          if (attempt < MAX_RETRIES) {
            console.log(`🔄 [OpenRouter] Retrying in 2 seconds...`);
            await this.sleep(2000);
            continue;
          } else {
            throw fetchError;
          }
        }

        const elapsed = Date.now() - startTime;

        // Handle rate limit (429)
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          console.warn(`⚠️ [OpenRouter] Rate limit 429, waiting ${retryAfter}s before retry ${attempt}/${MAX_RETRIES}...`);

          if (attempt < MAX_RETRIES) {
            await this.sleep(retryAfter * 1000);
            console.log(`✅ [OpenRouter] Retry ${attempt}/${MAX_RETRIES} successful after ${retryAfter}s wait`);
            continue; // Retry
          } else {
            // Max retries reached
            console.error(`❌ [OpenRouter] All ${MAX_RETRIES} retries exhausted, rate limit persists`);
            throw new RateLimitError(
              `Rate limit exceeded after ${MAX_RETRIES} attempts`,
              retryAfter
            );
          }
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          console.error(`❌ [OpenRouter] API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
          throw new Error(
            `OpenRouter API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
          );
        }

        const data = await response.json();

        // Validate response structure
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          console.error('❌ [OpenRouter] Invalid response structure:', JSON.stringify(data).substring(0, 200));
          throw new Error('Invalid response: no choices array');
        }

        if (!data.choices[0].message || !data.choices[0].message.content) {
          console.error('❌ [OpenRouter] Invalid message structure:', JSON.stringify(data.choices[0]).substring(0, 200));
          throw new Error('Invalid response: no message content');
        }

        const translated = data.choices[0].message.content;

        console.log(`✅ [OpenRouter] Translation successful (${elapsed}ms)`);
        console.log(`📊 [OpenRouter] Result length: ${translated.length} chars`);

        return translated.trim();
      } catch (error) {
        lastError = error as Error;

        // If it's a RateLimitError, rethrow immediately (already retried)
        if (error instanceof RateLimitError) {
          throw error;
        }

        // For other errors, log and continue to next attempt
        console.error(`❌ [OpenRouter] Translation error (attempt ${attempt}/${MAX_RETRIES}):`, error);

        if (attempt < MAX_RETRIES) {
          console.log(`🔄 [OpenRouter] Retrying in 2 seconds...`);
          await this.sleep(2000);
        }
      }
    }

    // All retries failed
    console.error('❌ [OpenRouter] All retry attempts failed');
    throw lastError || new Error('Translation failed after all retries');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    texts: string[],
    options: TranslateOptions = {}
  ): Promise<string[]> {
    if (texts.length === 0) return [];

    console.log(`📦 [OpenRouter] Batch translation: ${texts.length} texts`);

    // For large batches, split into chunks to avoid timeout/errors
    const CHUNK_SIZE = 50;
    if (texts.length > CHUNK_SIZE) {
      console.log(`📦 [OpenRouter] Large batch detected, splitting into chunks of ${CHUNK_SIZE}`);
      const results: string[] = [];

      for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        const chunk = texts.slice(i, i + CHUNK_SIZE);
        console.log(`📦 [OpenRouter] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(texts.length / CHUNK_SIZE)} (${chunk.length} texts)`);
        const chunkResults = await this.translateBatch(chunk, options);
        results.push(...chunkResults);
      }

      console.log(`✅ [OpenRouter] All chunks processed: ${results.length} total results`);
      return results;
    }

    // Join texts with separator
    const batch = texts.join('\n###SPLIT###\n');
    const translated = await this.translate(batch, options);

    // Split back
    const results = translated.split('\n###SPLIT###\n').map(t => t.trim());

    // Ensure same length
    if (results.length !== texts.length) {
      console.warn(
        `⚠️ [OpenRouter] Batch mismatch: expected ${texts.length}, got ${results.length}. Falling back to individual translation.`
      );
      // Fallback to individual translation
      return Promise.all(texts.map(t => this.translate(t, options)));
    }

    console.log(`✅ [OpenRouter] Batch translation successful: ${results.length} results`);
    return results;
  }

  /**
   * Build system prompt for translation
   */
  private buildSystemPrompt(targetLang: string, preserveFormatting: boolean): string {
    let prompt = `You are a professional translator. Translate from English to ${targetLang}.`;

    if (preserveFormatting) {
      prompt += `

CRITICAL RULES:
1. Preserve ALL Minecraft color codes: §0-§9, §a-§f, §k-§r
2. Preserve ALL placeholders: %s, %d, %1$s, {0}, {1}, %(name)s
3. Preserve escape sequences: \\n, \\t
4. Use official Minecraft Russian terminology:
   - Diamond → Алмазный
   - Iron → Железный
   - Gold → Золотой
   - Sword → Меч
   - Pickaxe → Кирка
   - Ingot → Слиток
   - Ore → Руда
5. Return ONLY the translation, no explanations

Example:
Input: "§6Diamond Sword§r - Deals %s damage"
Output: "§6Алмазный меч§r - Наносит %s урона"`;
    } else {
      prompt += '\n\nReturn ONLY the translation, no explanations.';
    }

    return prompt;
  }

  /**
   * Get current model name
   */
  getModel(): string {
    return this.model;
  }
}

// Singleton instance
export const openrouterTranslator = new OpenRouterTranslator();
