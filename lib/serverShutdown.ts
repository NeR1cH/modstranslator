/**
 * Server Shutdown Manager
 * Handles graceful shutdown when both translation providers fail
 */

import { getTranslationCache } from './translationCache';
import { getFragmentCache } from './fragmentCache';
import { getWordCache } from './wordCache';

let shutdownTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Print cache statistics
 */
export function printCacheStats(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 СТАТИСТИКА КЭШЕЙ');
  console.log('='.repeat(60));

  // Translation Cache stats
  try {
    const translationCache = getTranslationCache();
    const stats = translationCache.getStats();
    console.log('\n📦 Translation Cache:');
    console.log(`   Записей: ${stats.size}`);
    console.log(`   Использовано: ${stats.total} (Hits: ${stats.hits}, Misses: ${stats.misses})`);
    console.log(`   Hit Rate: ${stats.hitRate}%`);
  } catch (error) {
    console.log('\n📦 Translation Cache: недоступен');
  }

  // Fragment Cache stats
  try {
    const fragmentCache = getFragmentCache();
    const stats = fragmentCache.getStats();
    console.log('\n🧩 Fragment Cache:');
    console.log(`   Всего фрагментов: ${stats.total} (Слов: ${stats.words}, Фраз: ${stats.phrases})`);
    console.log(`   Использовано: ${stats.hits + stats.misses} (Hits: ${stats.hits}, Misses: ${stats.misses})`);
    console.log(`   Hit Rate: ${stats.hitRate}%`);
  } catch (error) {
    console.log('\n🧩 Fragment Cache: недоступен');
  }

  // Word Cache stats
  try {
    const wordCache = getWordCache();
    const stats = wordCache.getStats();
    console.log('\n📝 Word Cache:');
    console.log(`   Всего слов: ${stats.totalWords}`);
    console.log(`   Средняя уверенность: ${stats.avgConfidence.toFixed(1)}%`);
  } catch (error) {
    console.log('\n📝 Word Cache: недоступен');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Schedule server shutdown after 15 seconds
 */
export function scheduleShutdown(reason: string): void {
  if (isShuttingDown) {
    console.log('⚠️ [Shutdown] Already shutting down...');
    return;
  }

  console.error('\n' + '='.repeat(60));
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Оба провайдера перевода недоступны');
  console.error('='.repeat(60));
  console.error(`Причина: ${reason}`);
  console.error('Сервер будет остановлен через 15 секунд...');
  console.error('='.repeat(60) + '\n');

  isShuttingDown = true;

  shutdownTimer = setTimeout(() => {
    performShutdown();
  }, 15000);
}

/**
 * Cancel scheduled shutdown
 */
export function cancelShutdown(): void {
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
    isShuttingDown = false;
    console.log('✅ [Shutdown] Отмена завершения работы - провайдер восстановлен');
  }
}

/**
 * Perform graceful shutdown
 */
function performShutdown(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 СТАТИСТИКА ПЕРЕД ЗАВЕРШЕНИЕМ');
  console.log('='.repeat(60));

  // Flush all caches to disk before showing stats
  try {
    const translationCache = getTranslationCache();
    translationCache.flush();
  } catch (error) {
    console.error('⚠️ [Shutdown] Failed to flush translation cache:', error);
  }

  try {
    const fragmentCache = getFragmentCache();
    fragmentCache.flush();
  } catch (error) {
    console.error('⚠️ [Shutdown] Failed to flush fragment cache:', error);
  }

  try {
    const wordCache = getWordCache();
    wordCache.flush();
  } catch (error) {
    console.error('⚠️ [Shutdown] Failed to flush word cache:', error);
  }

  // Print cache statistics
  printCacheStats();

  console.log('🛑 ЗАВЕРШЕНИЕ РАБОТЫ СЕРВЕРА');
  console.log('='.repeat(60) + '\n');

  // Force exit
  process.exit(1);
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownScheduled(): boolean {
  return isShuttingDown;
}
