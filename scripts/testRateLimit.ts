/**
 * Test script to simulate OpenRouter rate limit (429) handling
 *
 * Expected behavior:
 * - First 2 requests return 429 with Retry-After: 2
 * - Third request succeeds
 * - Should NOT fallback to DeepL
 * - Should retry with OpenRouter
 * - translationPipeline should handle RateLimitError and retry up to 5 times
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file FIRST
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Override for test
process.env.TRANSLATION_PROVIDER = 'openrouter';
process.env.NODE_ENV = 'test';

console.log('Environment check:');
console.log('TRANSLATION_PROVIDER:', process.env.TRANSLATION_PROVIDER);
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET');
console.log('DEEPL_API_KEY:', process.env.DEEPL_API_KEY ? 'SET' : 'NOT SET');
console.log('');

// Mock fetch globally
let fetchCallCount = 0;
const originalFetch = global.fetch;

global.fetch = (async (url: string | URL | Request, options?: any) => {
  fetchCallCount++;

  console.log(`\n[MOCK FETCH] Call #${fetchCallCount}`);
  console.log(`[MOCK FETCH] URL: ${url}`);

  // First 2 calls return 429
  if (fetchCallCount <= 2) {
    console.log(`[MOCK FETCH] ❌ Returning 429 (rate limit)`);

    const headers = new Headers();
    headers.set('Retry-After', '2'); // Shorter wait for faster test

    return Promise.resolve({
      ok: false,
      status: 429,
      headers,
      json: async () => ({ error: { message: 'Rate limit exceeded' } })
    } as Response);
  }

  // Third+ calls succeed
  console.log(`[MOCK FETCH] ✅ Returning 200 (success)`);

  // Parse request body to check if it's a batch
  const body = options?.body ? JSON.parse(options.body) : null;
  const userMessage = body?.messages?.find((m: any) => m.role === 'user')?.content || '';

  // Check if batch (contains ###SPLIT###)
  const isBatch = userMessage.includes('###SPLIT###');

  let responseContent: string;
  if (isBatch) {
    // Return batch response with same number of items
    const inputCount = userMessage.split('###SPLIT###').length;
    const translations = Array(inputCount).fill('Тестовый перевод');
    responseContent = translations.join('\n###SPLIT###\n');
    console.log(`[MOCK FETCH] Batch response: ${inputCount} items`);
  } else {
    // Single translation
    responseContent = 'Тестовый перевод';
    console.log(`[MOCK FETCH] Single response`);
  }

  return Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      choices: [{
        message: {
          content: responseContent
        }
      }]
    })
  } as Response);
}) as typeof fetch;

async function runTest() {
  console.log('\n=== RATE LIMIT TEST START ===\n');

  // Dynamic import AFTER env is set
  const { translateBatchThroughPipeline } = await import('../lib/translationPipeline');
  const { getRateLimitStatsTracker } = await import('../lib/rateLimitStats');

  // Reset stats before test
  const statsTracker = getRateLimitStatsTracker();
  statsTracker.reset();

  // Test strings from create111.snbt
  const testStrings = [
    'Collect 10 iron ingots',
    'Craft a diamond sword',
    'Build a wooden house',
    'Mine 5 gold ore',
    'Smelt copper ingots'
  ];

  console.log(`Testing with ${testStrings.length} strings\n`);

  try {
    const startTime = Date.now();

    // Translate through pipeline with progress tracking
    const results = await translateBatchThroughPipeline(testStrings, 'RU', {
      fileName: 'test-rate-limit.json',
      fileContent: JSON.stringify(testStrings)
    });

    const elapsed = Date.now() - startTime;

    console.log('\n=== RESULTS ===\n');
    results.forEach((result, i) => {
      console.log(`${i + 1}. "${testStrings[i]}"`);
      console.log(`   → "${result.text}"`);
      console.log(`   Source: ${result.source}`);
    });

    console.log(`\n=== STATISTICS ===\n`);
    console.log(`Total fetch calls: ${fetchCallCount}`);
    console.log(`Elapsed time: ${elapsed}ms`);

    // Verify expectations
    console.log(`\n=== VERIFICATION ===\n`);

    if (fetchCallCount >= 2) {
      console.log(`✅ Fetch called ${fetchCallCount} times (includes retries)`);
    } else {
      console.log(`❌ Expected at least 2 fetch calls, got ${fetchCallCount}`);
    }

    const openrouterCount = results.filter(r => r.source === 'openrouter').length;
    const deeplCount = results.filter(r => r.source === 'deepl').length;
    const cacheCount = results.filter(r => r.source === 'cache').length;

    console.log(`OpenRouter translations: ${openrouterCount}`);
    console.log(`DeepL translations: ${deeplCount}`);
    console.log(`Cache hits: ${cacheCount}`);

    if (deeplCount === 0) {
      console.log('✅ DeepL was NOT called (correct behavior)');
    } else {
      console.log(`❌ DeepL was called ${deeplCount} times (should be 0)`);
      console.log('⚠️ This indicates fallback to DeepL on rate limit');
    }

    if (results.every(r => r.source === 'openrouter' || r.source === 'cache')) {
      console.log('✅ All translations from OpenRouter or cache');
    } else {
      console.log('❌ Some translations from wrong source:');
      results.forEach((r, i) => {
        if (r.source !== 'openrouter' && r.source !== 'cache') {
          console.log(`   String ${i + 1}: source = ${r.source}`);
        }
      });
    }

    // With 2s retry-after and 2 retries, expect at least 4s elapsed
    if (elapsed >= 4000) {
      console.log(`✅ Elapsed time >= 4s (waited for retries)`);
    } else {
      console.log(`⚠️ Elapsed time < 4s (${elapsed}ms) - retries may not have waited full duration`);
    }

    // Verify rate limit stats
    console.log('\n=== RATE LIMIT STATS VERIFICATION ===\n');
    const stats = statsTracker.getStats();
    console.log(`Total pauses: ${stats.totalPauses}`);
    console.log(`Total wait time: ${stats.totalWaitTime}s`);
    console.log(`Successful retries: ${stats.successfulRetries}`);
    console.log(`Failed attempts: ${stats.failedAttempts}`);
    console.log(`Stop reason: ${stats.stopReason}`);

    if (stats.totalPauses === 2) {
      console.log('✅ Correct number of pauses (2)');
    } else {
      console.log(`❌ Expected 2 pauses, got ${stats.totalPauses}`);
    }

    if (stats.totalWaitTime === 4) {
      console.log('✅ Correct total wait time (4s)');
    } else {
      console.log(`❌ Expected 4s wait time, got ${stats.totalWaitTime}s`);
    }

    if (stats.successfulRetries === 2) {
      console.log('✅ Correct number of successful retries (2)');
    } else {
      console.log(`❌ Expected 2 successful retries, got ${stats.successfulRetries}`);
    }

    if (stats.stopReason === 'completed') {
      console.log('✅ Correct stop reason (completed)');
    } else {
      console.log(`❌ Expected stop reason "completed", got "${stats.stopReason}"`);
    }

    console.log('\n=== RATE LIMIT TEST END ===\n');

  } catch (error) {
    console.error('\n=== TEST FAILED ===\n');
    console.error('Error:', error);
    console.error('\nStack:', (error as Error).stack);

    console.log(`\nFetch calls before error: ${fetchCallCount}`);

    console.log('\n⚠️ Check translator.ts for hybrid mode fallback logic');
    console.log('⚠️ On rate limit, hybrid mode may fallback to DeepL instead of retrying OpenRouter');
  }
}

// Run test
runTest().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(err => {
  console.error('\nTest crashed:', err);
  process.exit(1);
});
