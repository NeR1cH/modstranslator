# 🎯 Приоритетные улучшения проекта MOD_TRANSLATOR

**Дата создания:** 2026-05-03  
**Текущая версия:** 3.2.0  
**Статус проекта:** ✅ Стабильный, все основные функции работают

---

## 📊 Критерии приоритизации

Улучшения отсортированы по следующим критериям:
1. **Влияние на пользователя** — насколько улучшение повысит удобство использования
2. **Техническая важность** — критичность для стабильности и производительности
3. **Сложность реализации** — время и усилия на внедрение
4. **ROI (Return on Investment)** — соотношение пользы к затратам

---

## 🔴 КРИТИЧЕСКИЙ ПРИОРИТЕТ

### 1. Streaming для больших модпаков
**Важность:** ⭐⭐⭐⭐⭐  
**Сложность:** Средняя  
**Время:** 2-3 дня

**Проблема:**
- При обработке больших модпаков (500+ MB) пользователь не видит прогресс
- Браузер может зависнуть или показать "страница не отвечает"
- Невозможно отследить, на каком этапе находится обработка

**Решение:**
Реализовать Server-Sent Events (SSE) для real-time обновления прогресса

**Технологии:**
- Next.js Streaming API
- Server-Sent Events (SSE)
- ReadableStream

**Пример реализации:**
```typescript
// app/api/translate-stream/route.ts
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  (async () => {
    try {
      const { files } = await req.json();
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Отправляем прогресс
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({
            type: 'progress',
            current: i + 1,
            total: files.length,
            fileName: file.name,
            status: 'processing'
          })}\n\n`
        ));
        
        // Обрабатываем файл
        const result = await processFile(file);
        
        // Отправляем результат
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({
            type: 'file_complete',
            fileName: file.name,
            translatedCount: result.count
          })}\n\n`
        ));
      }
      
      await writer.write(encoder.encode('data: {"type":"complete"}\n\n'));
    } catch (error) {
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
      ));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Польза:**
- Пользователь видит прогресс в реальном времени
- Можно показать, какой файл обрабатывается
- Снижается вероятность таймаутов
- Улучшается UX для больших модпаков

---

### 2. Unit и Integration тесты
**Важность:** ⭐⭐⭐⭐⭐  
**Сложность:** Средняя  
**Время:** 3-4 дня

**Проблема:**
- Нет автоматических тестов
- Регрессии могут быть не замечены
- Сложно проверить все форматы файлов вручную
- Рефакторинг рискован без тестов

**Решение:**
Добавить тестовое покрытие для критических компонентов

**Технологии:**
- Jest (unit тесты)
- Playwright (E2E тесты)
- Testing Library (React компоненты)

**Что тестировать:**

#### Unit тесты (lib/langParsers.ts):
```typescript
// __tests__/langParsers.test.ts
import { parseJsonLang, rebuildJsonLang } from '@/lib/langParsers';

describe('parseJsonLang', () => {
  it('should parse flat JSON lang file', () => {
    const input = '{"key1": "value1", "key2": "value2"}';
    const result = parseJsonLang(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: 'key1', value: 'value1' });
  });

  it('should handle empty JSON', () => {
    const input = '{}';
    const result = parseJsonLang(input);
    expect(result).toHaveLength(0);
  });

  it('should preserve special characters', () => {
    const input = '{"key": "§6Gold §rText"}';
    const result = parseJsonLang(input);
    expect(result[0].value).toBe('§6Gold §rText');
  });
});

describe('rebuildJsonLang', () => {
  it('should rebuild JSON from entries', () => {
    const entries = [
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' }
    ];
    const result = rebuildJsonLang(entries);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ key1: 'value1', key2: 'value2' });
  });
});
```

#### Integration тесты (API routes):
```typescript
// __tests__/api/analyze.test.ts
import { POST } from '@/app/api/analyze/route';

describe('/api/analyze', () => {
  it('should analyze JSON file', async () => {
    const mockRequest = {
      json: async () => ({
        base64: Buffer.from('{"key":"value"}').toString('base64'),
        fileName: 'test.json'
      })
    };

    const response = await POST(mockRequest as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stringsCount).toBe(1);
    expect(data.mode).toBe('file');
  });
});
```

#### E2E тесты (Playwright):
```typescript
// e2e/translation.spec.ts
import { test, expect } from '@playwright/test';

test('should translate a mod file', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Загрузить файл
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('./test-files/test-mod.jar');
  
  // Дождаться анализа
  await expect(page.locator('text=ОЖИДАНИЕ')).toBeVisible();
  
  // Запустить перевод
  await page.click('button:has-text("ЗАПУСТИТЬ ПЕРЕВОД")');
  
  // Дождаться завершения
  await expect(page.locator('text=ГОТОВО')).toBeVisible({ timeout: 30000 });
  
  // Проверить кнопку скачивания
  await expect(page.locator('button:has-text("СКАЧАТЬ")')).toBeEnabled();
});
```

**Польза:**
- Уверенность в стабильности кода
- Быстрое обнаружение регрессий
- Безопасный рефакторинг
- Документация через примеры

---

## 🟠 ВЫСОКИЙ ПРИОРИТЕТ

### 3. Rate Limiting для DeepL API
**Важность:** ⭐⭐⭐⭐  
**Сложность:** Низкая  
**Время:** 1 день

**Проблема:**
- Free план DeepL: 500,000 символов/месяц
- Нет контроля за расходом лимита
- Пользователь может исчерпать лимит за один большой модпак
- Нет предупреждения о приближении к лимиту

**Решение:**
Добавить трекинг использования API и предупреждения

**Реализация:**
```typescript
// lib/rateLimiter.ts
interface UsageStats {
  charactersUsed: number;
  requestsCount: number;
  lastReset: Date;
  monthlyLimit: number;
}

class DeepLRateLimiter {
  private stats: UsageStats;
  private readonly FREE_LIMIT = 500000;
  private readonly PRO_LIMIT = Infinity;

  constructor(apiKey: string) {
    this.stats = this.loadStats();
    this.stats.monthlyLimit = apiKey.endsWith(':fx') 
      ? this.FREE_LIMIT 
      : this.PRO_LIMIT;
  }

  async checkLimit(textLength: number): Promise<void> {
    // Сброс счетчика в начале месяца
    if (this.shouldReset()) {
      this.resetStats();
    }

    const remaining = this.stats.monthlyLimit - this.stats.charactersUsed;

    if (remaining < textLength) {
      throw new Error(
        `Недостаточно символов DeepL API. ` +
        `Использовано: ${this.stats.charactersUsed}/${this.stats.monthlyLimit}. ` +
        `Требуется: ${textLength}. ` +
        `Лимит обновится: ${this.getNextResetDate()}`
      );
    }

    // Предупреждение при 90% использования
    if (remaining < this.stats.monthlyLimit * 0.1) {
      console.warn(
        `⚠️ Осталось только ${remaining} символов DeepL API (${Math.round(remaining / this.stats.monthlyLimit * 100)}%)`
      );
    }
  }

  recordUsage(charactersUsed: number): void {
    this.stats.charactersUsed += charactersUsed;
    this.stats.requestsCount++;
    this.saveStats();
  }

  getUsageStats(): UsageStats {
    return { ...this.stats };
  }

  private shouldReset(): boolean {
    const now = new Date();
    const lastReset = new Date(this.stats.lastReset);
    return now.getMonth() !== lastReset.getMonth() || 
           now.getFullYear() !== lastReset.getFullYear();
  }

  private resetStats(): void {
    this.stats = {
      charactersUsed: 0,
      requestsCount: 0,
      lastReset: new Date(),
      monthlyLimit: this.stats.monthlyLimit
    };
    this.saveStats();
  }

  private getNextResetDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('ru-RU');
  }

  private loadStats(): UsageStats {
    // Загрузка из файла или БД
    // Для простоты можно использовать JSON файл
    try {
      const fs = require('fs');
      const data = fs.readFileSync('.deepl-usage.json', 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        charactersUsed: 0,
        requestsCount: 0,
        lastReset: new Date(),
        monthlyLimit: this.FREE_LIMIT
      };
    }
  }

  private saveStats(): void {
    const fs = require('fs');
    fs.writeFileSync('.deepl-usage.json', JSON.stringify(this.stats, null, 2));
  }
}

export const rateLimiter = new DeepLRateLimiter(process.env.DEEPL_API_KEY!);
```

**Использование:**
```typescript
// lib/deepl.ts
import { rateLimiter } from './rateLimiter';

export async function translateTexts(texts: string[]): Promise<string[]> {
  const totalChars = texts.join('').length;
  
  // Проверка лимита перед запросом
  await rateLimiter.checkLimit(totalChars);
  
  const translations = await callDeepLAPI(texts);
  
  // Запись использования
  rateLimiter.recordUsage(totalChars);
  
  return translations;
}
```

**UI для отображения статистики:**
```typescript
// app/api/usage/route.ts
export async function GET() {
  const stats = rateLimiter.getUsageStats();
  return Response.json(stats);
}

// components/UsageIndicator.tsx
export function UsageIndicator() {
  const [stats, setStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.json())
      .then(setStats);
  }, []);

  if (!stats) return null;

  const percentage = (stats.charactersUsed / stats.monthlyLimit) * 100;

  return (
    <div className="usage-indicator">
      <div className="usage-bar" style={{ width: `${percentage}%` }} />
      <span>
        {stats.charactersUsed.toLocaleString()} / {stats.monthlyLimit.toLocaleString()} символов
        ({percentage.toFixed(1)}%)
      </span>
    </div>
  );
}
```

**Польза:**
- Контроль расхода API лимита
- Предупреждения перед исчерпанием
- Статистика использования
- Защита от случайного перерасхода

---

### 4. Кэширование переводов
**Важность:** ⭐⭐⭐⭐  
**Сложность:** Средняя  
**Время:** 2 дня

**Проблема:**
- Повторные переводы одинаковых строк тратят API лимит
- Стандартные строки Minecraft переводятся каждый раз заново
- Нет переиспользования переводов между сессиями

**Решение:**
Кэшировать переводы на сервере

**Реализация:**
```typescript
// lib/translationCache.ts
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.translation-cache');
const CACHE_VERSION = 'v1';

interface CacheEntry {
  original: string;
  translated: string;
  timestamp: number;
  hash: string;
}

class TranslationCache {
  private memoryCache = new Map<string, string>();
  private cacheFile: string;

  constructor() {
    this.cacheFile = path.join(CACHE_DIR, `cache-${CACHE_VERSION}.json`);
    this.init();
  }

  private async init() {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await this.loadFromDisk();
    } catch (error) {
      console.error('[cache] Init error:', error);
    }
  }

  private getHash(text: string): string {
    return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
  }

  async get(text: string): Promise<string | null> {
    const hash = this.getHash(text);
    
    // Проверка в памяти
    if (this.memoryCache.has(hash)) {
      console.log('[cache] HIT (memory):', text.substring(0, 50));
      return this.memoryCache.get(hash)!;
    }

    return null;
  }

  async set(original: string, translated: string): Promise<void> {
    const hash = this.getHash(original);
    this.memoryCache.set(hash, translated);
    
    // Асинхронная запись на диск (не блокирует)
    this.saveToDisk().catch(err => 
      console.error('[cache] Save error:', err)
    );
  }

  async getMany(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const text of texts) {
      const cached = await this.get(text);
      if (cached) {
        results.set(text, cached);
      }
    }
    
    return results;
  }

  async setMany(pairs: Array<{ original: string; translated: string }>): Promise<void> {
    for (const { original, translated } of pairs) {
      await this.set(original, translated);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const entries: CacheEntry[] = JSON.parse(data);
      
      for (const entry of entries) {
        this.memoryCache.set(entry.hash, entry.translated);
      }
      
      console.log(`[cache] Loaded ${entries.length} entries from disk`);
    } catch (error) {
      // Файл не существует - это нормально при первом запуске
      console.log('[cache] No cache file found, starting fresh');
    }
  }

  private async saveToDisk(): Promise<void> {
    const entries: CacheEntry[] = [];
    
    for (const [hash, translated] of this.memoryCache.entries()) {
      entries.push({
        original: '', // Не храним оригинал для экономии места
        translated,
        timestamp: Date.now(),
        hash
      });
    }
    
    await fs.writeFile(this.cacheFile, JSON.stringify(entries, null, 2));
    console.log(`[cache] Saved ${entries.length} entries to disk`);
  }

  getStats() {
    return {
      size: this.memoryCache.size,
      cacheFile: this.cacheFile
    };
  }
}

export const translationCache = new TranslationCache();
```

**Интеграция с DeepL:**
```typescript
// lib/deepl.ts
import { translationCache } from './translationCache';

export async function translateTexts(texts: string[]): Promise<string[]> {
  // Проверка кэша
  const cached = await translationCache.getMany(texts);
  const uncached = texts.filter(t => !cached.has(t));
  
  console.log(`[deepl] Cache: ${cached.size} hits, ${uncached.length} misses`);
  
  // Переводим только некэшированные
  let newTranslations: string[] = [];
  if (uncached.length > 0) {
    newTranslations = await callDeepLAPI(uncached);
    
    // Сохраняем в кэш
    await translationCache.setMany(
      uncached.map((original, i) => ({
        original,
        translated: newTranslations[i]
      }))
    );
  }
  
  // Собираем результат в правильном порядке
  const results: string[] = [];
  let uncachedIndex = 0;
  
  for (const text of texts) {
    if (cached.has(text)) {
      results.push(cached.get(text)!);
    } else {
      results.push(newTranslations[uncachedIndex++]);
    }
  }
  
  return results;
}
```

**Польза:**
- Экономия API лимита (до 70% для стандартных модов)
- Мгновенный перевод повторяющихся строк
- Ускорение обработки больших модпаков
- Переиспользование между сессиями

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ

### 5. Отмена операции перевода
**Важность:** ⭐⭐⭐  
**Сложность:** Средняя  
**Время:** 1-2 дня

**Проблема:**
- Нельзя остановить перевод после запуска
- При ошибке нужно ждать таймаута
- Нет контроля над длительными операциями

**Решение:**
Добавить AbortController для отмены запросов

**Реализация:**
```typescript
// app/page.tsx
const [abortController, setAbortController] = useState<AbortController | null>(null);

async function handleTranslate() {
  const controller = new AbortController();
  setAbortController(controller);
  
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      body: JSON.stringify(data),
      signal: controller.signal
    });
    // ...
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Translation cancelled by user');
    }
  } finally {
    setAbortController(null);
  }
}

function handleCancel() {
  if (abortController) {
    abortController.abort();
    setIsTranslating(false);
  }
}

// UI
{isTranslating && (
  <button onClick={handleCancel}>
    ✕ ОТМЕНИТЬ
  </button>
)}
```

**Польза:**
- Контроль над длительными операциями
- Возможность исправить ошибку без ожидания
- Лучший UX

---

### 6. Batch download (скачать все файлы)
**Важность:** ⭐⭐⭐  
**Сложность:** Низкая  
**Время:** 0.5 дня

**Проблема:**
- При переводе нескольких файлов нужно скачивать каждый отдельно
- Неудобно для пакетной обработки

**Решение:**
Добавить кнопку "Скачать все как ZIP"

**Реализация:**
```typescript
// app/page.tsx
async function handleDownloadAll() {
  const response = await fetch('/api/export', {
    method: 'POST',
    body: JSON.stringify({
      files: fileQueue.filter(f => f.status === 'completed')
    })
  });
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translated-${Date.now()}.zip`;
  a.click();
}

// UI
{completedCount > 1 && (
  <button onClick={handleDownloadAll}>
    📦 СКАЧАТЬ ВСЕ ({completedCount})
  </button>
)}
```

**Польза:**
- Удобство при пакетной обработке
- Экономия времени

---

### 7. История переводов
**Важность:** ⭐⭐⭐  
**Сложность:** Средняя  
**Время:** 1-2 дня

**Проблема:**
- После перезагрузки страницы вся история теряется
- Нельзя вернуться к предыдущим переводам

**Решение:**
Сохранять историю в localStorage/IndexedDB

**Реализация:**
```typescript
// lib/historyStorage.ts
interface HistoryEntry {
  id: string;
  fileName: string;
  timestamp: number;
  stringsCount: number;
  resultBase64: string;
}

export class TranslationHistory {
  private readonly STORAGE_KEY = 'translation_history';
  private readonly MAX_ENTRIES = 50;

  async save(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
    const history = await this.getAll();
    
    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    history.unshift(newEntry);
    
    // Ограничение количества записей
    if (history.length > this.MAX_ENTRIES) {
      history.splice(this.MAX_ENTRIES);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  async getAll(): Promise<HistoryEntry[]> {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  async delete(id: string): Promise<void> {
    const history = await this.getAll();
    const filtered = history.filter(e => e.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const history = new TranslationHistory();
```

**UI компонент:**
```typescript
// components/HistoryPanel.tsx
export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    history.getAll().then(setEntries);
  }, []);

  async function handleDownload(entry: HistoryEntry) {
    const blob = base64ToBlob(entry.resultBase64);
    downloadBlob(blob, entry.fileName);
  }

  return (
    <div className="history-panel">
      <h3>📜 История переводов</h3>
      {entries.map(entry => (
        <div key={entry.id} className="history-entry">
          <span>{entry.fileName}</span>
          <span>{new Date(entry.timestamp).toLocaleString()}</span>
          <span>{entry.stringsCount} строк</span>
          <button onClick={() => handleDownload(entry)}>
            ⬇️ Скачать
          </button>
          <button onClick={() => history.delete(entry.id)}>
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Польза:**
- Доступ к предыдущим переводам
- Не нужно переводить заново
- Удобство для повторяющихся задач

---

## 🟢 НИЗКИЙ ПРИОРИТЕТ

### 8. Дополнительные форматы файлов
**Важность:** ⭐⭐  
**Сложность:** Низкая  
**Время:** 1 день на формат

**Форматы для добавления:**
- `.properties` (Java properties)
- `.yml` / `.yaml` (YAML конфиги)
- `.ini` (INI конфиги)
- `.po` / `.pot` (gettext)

### 9. Темная/светлая тема
**Важность:** ⭐⭐  
**Сложность:** Низкая  
**Время:** 0.5 дня

### 10. Мультиязычность интерфейса
**Важность:** ⭐⭐  
**Сложность:** Средняя  
**Время:** 1-2 дня

---

## 📈 Рекомендуемый порядок внедрения

### Фаза 1 (Неделя 1-2): Стабильность
1. ✅ Unit и Integration тесты
2. ✅ Rate Limiting для DeepL API

### Фаза 2 (Неделя 3-4): Производительность
3. ✅ Кэширование переводов
4. ✅ Streaming для больших модпаков

### Фаза 3 (Неделя 5-6): UX улучшения
5. ✅ Отмена операции перевода
6. ✅ Batch download
7. ✅ История переводов

### Фаза 4 (По желанию): Дополнительные функции
8. ⚪ Дополнительные форматы
9. ⚪ Темная/светлая тема
10. ⚪ Мультиязычность

---

## 📊 Метрики успеха

После внедрения улучшений отслеживать:
- **Скорость обработки** — время перевода модпака 100 MB
- **Экономия API** — процент кэш-хитов
- **Стабильность** — количество ошибок на 100 переводов
- **Удовлетворенность** — отзывы пользователей

---

## 🎯 Итоговая оценка

**Текущее состояние проекта:** 8/10
- ✅ Все основные функции работают
- ✅ Поддержка 10 форматов файлов
- ✅ Хорошая обработка ошибок
- ✅ Понятный интерфейс

**После внедрения улучшений:** 10/10
- ✅ Production-ready
- ✅ Масштабируемость
- ✅ Отличный UX
- ✅ Высокая надежность
