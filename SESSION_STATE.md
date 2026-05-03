# 🎮 MOD_TRANSLATOR - Состояние проекта на 04.05.2026 01:39

## 📋 Что это за проект

**MOD_TRANSLATOR** — веб-приложение для автоматического перевода модов и модпаков Minecraft с английского на русский через DeepL API.

### Основные возможности:
- Перевод JAR-файлов модов (языковые файлы `en_us.json` → `ru_ru.json`)
- Перевод ZIP-архивов модпаков (все моды внутри + квесты)
- Перевод FTB Quests (файлы квестов в формате SNBT)
- Кэширование переводов (экономия API лимита до 70%)
- Поддержка файлов до 1.5GB через streaming upload

### Технологии:
- **Next.js 14** (App Router) + TypeScript
- **DeepL API** для перевода
- **JSZip** для работы с архивами
- **Node.js** серверная часть

---

## 🔧 Текущая проблема (НА ЧЁМ ОСТАНОВИЛИСЬ)

### Проблема: FTB Quests не переводятся

**Симптомы:**
- Файл `config/ftbquests/quests/lang/en_us.snbt` содержит ~1000 строк текста квестов
- После перевода файл `config/ftbquests/quests/lang/ru_ru.snbt` содержит только 1 строку
- Квесты остаются на английском языке

**Что уже сделано:**

1. ✅ Добавлена поддержка FTB Quests lang формата в парсере SNBT
2. ✅ Обновлена функция `isTargetLangFile` для распознавания `.snbt` файлов
3. ✅ Исправлена функция `sanitizePath` для разрешения файлов в `config/`
4. ✅ Исправлен порядок проверок в `getStrategy` (`.snbt` lang файлы проверяются первыми)

**Последнее изменение (04.05.2026 01:35):**
```typescript
// lib/modpackProcessor.ts - getStrategy()
// Проверка .snbt lang файлов ПЕРЕД isTargetLangFile
if (lower.endsWith('.snbt') && lower.includes('/lang/')) return 'snbt';
```

**Статус:** Dev-сервер запущен на http://localhost:3001 с исправлениями, готов к тестированию.

---

## 📂 Структура проекта

```
modstranslator/
├── app/
│   ├── page.tsx                    # Главная страница (UI)
│   ├── layout.tsx                  # Root layout
│   └── api/
│       ├── upload-stream/route.ts  # Загрузка больших файлов (>800MB)
│       ├── process-upload/route.ts # Обработка файлов с диска
│       ├── download-result/route.ts # Скачивание результата
│       ├── translate-stream/route.ts # Перевод маленьких файлов
│       └── analyze/route.ts        # Анализ файла
│
├── lib/
│   ├── modpackProcessor.ts         # ⚠️ ОСНОВНОЙ ФАЙЛ - обработка модпаков
│   ├── langParsers.ts              # ⚠️ ПАРСЕРЫ - parseSnbt, rebuildSnbt
│   ├── deepl.ts                    # DeepL API клиент
│   ├── security.ts                 # ⚠️ sanitizePath - разрешённые папки
│   ├── translationCache.ts         # Кэш переводов
│   └── queueLimits.ts              # Лимиты (1.5GB max)
│
├── components/
│   ├── DropZone.tsx                # Drag & drop загрузка
│   ├── ProgressBar.tsx             # Прогресс-бар
│   └── ...
│
├── modsfortranslate/               # ⚠️ ТЕСТОВЫЕ ФАЙЛЫ (не в git)
│   ├── servers.zip                 # Оригинальный модпак (1015MB)
│   └── servers_translated.zip      # Переведённый (1014MB)
│
└── .env                            # DeepL API ключ
```

---

## 🔍 Ключевые файлы и функции

### 1. `lib/modpackProcessor.ts`

**Функция `getStrategy(path: string)`** - определяет, как парсить файл:

```typescript
function getStrategy(path: string): string | null {
  if (shouldSkip(path)) return null;
  const lower = path.toLowerCase();

  // ⚠️ ВАЖНО: Проверка .snbt lang файлов ПЕРВОЙ
  if (lower.endsWith('.snbt') && lower.includes('/lang/')) return 'snbt';

  // JAR lang files (en_us.json, en_us.lang)
  if (isTargetLangFile(path)) return 'lang_json_or_lang';

  // Обычные SNBT файлы (квесты)
  if (lower.endsWith('.snbt')) return 'snbt';

  // Nested JSON (Patchouli книги)
  if (lower.endsWith('.json') && lower.includes('quest')) return 'nested_json';

  return null;
}
```

**Функция `getRuPath(originalPath: string)`** - генерирует путь для русского файла:

```typescript
function getRuPath(originalPath: string): string {
  return originalPath
    .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
    .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
    .replace(/en[_-]?(us|US)?\.snbt$/i, 'ru_ru.snbt')  // ⚠️ Добавлено
    .replace(/en\.json$/i, 'ru_ru.json')
    .replace(/en\.lang$/i, 'ru_ru.lang')
    .replace(/en\.snbt$/i, 'ru_ru.snbt');  // ⚠️ Добавлено
}
```

### 2. `lib/langParsers.ts`

**Функция `isTargetLangFile(path: string)`** - определяет языковые файлы:

```typescript
export function isTargetLangFile(path: string): boolean {
  // Mod lang files (assets/*/lang/en_us.json or en_us.lang)
  const modLang = /assets\/[^/]+\/lang\/en[_-]?(us|US)?(\.(json|lang))?$/.test(path);

  // FTB Quests lang files (config/ftbquests/quests/lang/en_us.snbt)
  const ftbQuestsLang = /config\/ftbquests\/quests\/lang\/en[_-]?(us|US)?\.snbt$/i.test(path);

  return modLang || ftbQuestsLang;
}
```

**Функция `parseSnbt(content: string)`** - парсит SNBT файлы:

```typescript
export function parseSnbt(content: string): LangEntry[] {
  const entries: LangEntry[] = [];

  // Проверка: это FTB Quests lang файл?
  const isFTBQuestsLang = /^\s*(quest|chapter|task|reward)\.[A-F0-9]+\./m.test(content);

  if (isFTBQuestsLang) {
    // FTB Quests формат: quest.ID.quest_desc: ["text"]
    content.split('\n').forEach((line, i) => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) return;

      const key = match[1].trim();
      const valueStr = match[2].trim();

      // Извлечь текст из "value" или ["value1", "value2"]
      let values: string[] = [];

      if (valueStr.startsWith('[')) {
        // Array: ["text1", "text2"]
        const arrayMatch = valueStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
        if (arrayMatch) {
          values = arrayMatch.map(s => s.slice(1, -1).replace(/\\"/g, '"'));
        }
      } else if (valueStr.startsWith('"')) {
        // Simple: "text"
        const simpleMatch = valueStr.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (simpleMatch) {
          values = [simpleMatch[1].replace(/\\"/g, '"')];
        }
      }

      values.forEach((value, idx) => {
        if (hasTranslatableText(value)) {
          entries.push({ key: `${key}[${idx}]`, value });
        }
      });
    });
  } else {
    // Обычный SNBT формат (description: "text")
    // ... старый код ...
  }

  return entries;
}
```

**Функция `rebuildSnbt(original: string, translations: Map<string, string>)`** - восстанавливает SNBT:

```typescript
export function rebuildSnbt(original: string, translations: Map<string, string>): string {
  const isFTBQuestsLang = /^\s*(quest|chapter|task|reward)\.[A-F0-9]+\./m.test(original);

  if (isFTBQuestsLang) {
    // Заменить переводы в FTB Quests формате
    return original.split('\n').map(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) return line;

      const key = match[1].trim();
      const valueStr = match[2].trim();

      // Проверить, есть ли переводы для этого ключа
      // ... код замены ...

      return line;
    }).join('\n');
  } else {
    // Обычный SNBT формат
    // ... старый код ...
  }
}
```

### 3. `lib/security.ts`

**Функция `sanitizePath(filePath: string)`** - проверка безопасности путей:

```typescript
export function sanitizePath(filePath: string): string {
  const normalized = filePath
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/\\+/g, '/');

  // ⚠️ Разрешённые папки
  const safePrefixes = [
    'assets/',
    'config/',                    // ⚠️ Добавлено для FTB Quests
    'data/',
    'saves/',
    'local/',
    'dynamic-resource-pack-cache/',
  ];

  const isSafe = safePrefixes.some(prefix => normalized.startsWith(prefix));

  if (!isSafe) {
    throw new Error(`Invalid file path: must be inside safe directories`);
  }

  return normalized;
}
```

---

## 🐛 История проблемы и исправлений

### Проблема 1: Файлы >800MB вызывали "out of memory"
**Причина:** Браузер пытался конвертировать 1GB файл в base64 в памяти  
**Решение:** Streaming upload через FormData + сохранение результата на диск

### Проблема 2: Файлы в `config/` блокировались
**Причина:** `sanitizePath` разрешал только `assets/`  
**Решение:** Добавлены `config/`, `data/`, `saves/` в список разрешённых

### Проблема 3: FTB Quests lang файлы не распознавались
**Причина:** `isTargetLangFile` искал только `assets/*/lang/`  
**Решение:** Добавлена проверка `config/ftbquests/quests/lang/en_us.snbt`

### Проблема 4: FTB Quests lang файлы парсились неправильно
**Причина:** `getStrategy` возвращал `lang_json_or_lang` вместо `snbt`  
**Решение:** Проверка `.snbt && /lang/` перемещена ПЕРЕД `isTargetLangFile`

### Проблема 5: Парсер SNBT не понимал FTB Quests формат
**Причина:** Парсер искал `description:`, а FTB Quests использует `quest.ID.quest_desc:`  
**Решение:** Добавлена отдельная логика для FTB Quests lang формата

---

## 📝 Что делать дальше (ЗАВТРА)

### Шаг 1: Протестировать исправления

1. Открой http://localhost:3001 (dev-сервер должен быть запущен)
2. Загрузи оригинальный файл `modsfortranslate/servers.zip` (1015MB)
3. Нажми "ЗАПУСТИТЬ ПЕРЕВОД"
4. Дождись завершения (7-10 минут)
5. Скачай результат в `modsfortranslate/servers_translated.zip`

### Шаг 2: Проверить результат

Выполни команду:
```bash
cd "C:\VSCODE PROJECTS\modstranslator\modsfortranslate"
unzip -p servers_translated.zip "config/ftbquests/quests/lang/ru_ru.snbt" | head -50
```

**Ожидаемый результат:**
```
{
	chapter.04B861778782AA8D.title: "Create: Добыча руды"
	chapter.1ED128AB6271A286.title: "Create: Дизельный генератор"
	chapter.2F793C074F0F4597.title: "&e&lSteampunk\\ &l&3Эпоха\\"
	quest.013A9FE20739783C.quest_desc: ["Выкуйте мощную буровую головку из латуни."]
	quest.01674EEEB2CE0A4F.quest_desc: ["Создайте коробку как часть дизайна копии для дополнительного хранения или структуры."]
	...
}
```

**Если файл всё ещё пустой:**
- Проверь логи сервера: `tail -100 tasks/bxbp7stfd.output | grep "ftbquests"`
- Найди строку `[modpackProcessor] translateSingleFile: config/ftbquests/quests/lang/en_us.snbt`
- Проверь, какая стратегия используется: должно быть `Strategy: snbt`
- Проверь, сколько записей извлечено: должно быть `Entries extracted: 1000+`

### Шаг 3: Если всё работает

1. Сравни оригинальный и переведённый архивы:
```bash
# Посмотреть оригинальные квесты
unzip -p servers.zip "config/ftbquests/quests/lang/en_us.snbt" | head -20

# Посмотреть переведённые квесты
unzip -p servers_translated.zip "config/ftbquests/quests/lang/ru_ru.snbt" | head -20
```

2. Запушь все изменения на GitHub:
```bash
git push origin main
```

3. Обнови README.md с информацией о поддержке FTB Quests

### Шаг 4: Если не работает

**Дебаг:**

1. Проверь, что dev-сервер использует новый код:
```bash
# Перезапусти сервер
npm run dev
```

2. Добавь больше логов в `lib/langParsers.ts`:
```typescript
export function parseSnbt(content: string): LangEntry[] {
  console.log('[parseSnbt] Content length:', content.length);
  const isFTBQuestsLang = /^\s*(quest|chapter|task|reward)\.[A-F0-9]+\./m.test(content);
  console.log('[parseSnbt] Is FTB Quests lang:', isFTBQuestsLang);
  
  // ... остальной код ...
  
  console.log('[parseSnbt] Extracted entries:', entries.length);
  return entries;
}
```

3. Проверь, что файл `en_us.snbt` действительно содержит квесты:
```bash
unzip -p servers.zip "config/ftbquests/quests/lang/en_us.snbt" | grep "quest_desc" | wc -l
# Должно быть ~500-1000 строк
```

---

## 🚀 Команды для быстрого старта

```bash
# Перейти в проект
cd "C:\VSCODE PROJECTS\modstranslator"

# Запустить dev-сервер
npm run dev
# Откроется на http://localhost:3000 или 3001

# Собрать проект
npm run build

# Проверить статус git
git status

# Посмотреть последние коммиты
git log --oneline -10

# Запушить изменения
git push origin main
```

---

## 📊 Статистика проекта

- **Всего коммитов:** 11 (за сегодня)
- **Размер проекта:** ~110 kB (бандл)
- **Поддерживаемые форматы:** JSON, LANG, SNBT, TOML, CFG, XML
- **Максимальный размер файла:** 1.5 GB
- **DeepL API использование:** 57,571 / 500,000 символов

---

## 🔗 Полезные ссылки

- **GitHub:** https://github.com/NeR1cH/modstranslator
- **DeepL API:** https://www.deepl.com/pro-api
- **Next.js Docs:** https://nextjs.org/docs
- **FTB Quests Wiki:** https://ftb.fandom.com/wiki/FTB_Quests

---

## ⚠️ Важные замечания

1. **Dev-сервер может запуститься на порту 3001** если 3000 занят
2. **Файлы в `modsfortranslate/` не коммитятся** (в .gitignore)
3. **DeepL API ключ в `.env`** - не коммитить!
4. **Кэш переводов в `.translation-cache/`** - сохраняется между запусками
5. **Временные файлы в `C:\Users\boyko\AppData\Local\Temp\modtranslator-*`** - автоудаление после скачивания

---

## 📞 Контакты

- **Автор:** NeR1cH
- **Дата последнего обновления:** 04.05.2026 01:39
- **Версия:** 3.10.1

---

**УДАЧИ ЗАВТРА! 🚀**
