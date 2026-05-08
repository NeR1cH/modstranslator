# OpenRouter Integration Guide

## Что это?

Гибридная система перевода, которая автоматически переключается между OpenRouter (бесплатная LLM) и DeepL при ошибках.

---

## Быстрый старт

### 1. Получи API ключ OpenRouter

1. Перейди на [openrouter.ai](https://openrouter.ai)
2. Войди через Google/GitHub
3. Перейди в **Keys** → **Create Key**
4. Скопируй ключ (формат: `sk-or-v1-...`)

### 2. Настрой `.env`

```env
# Гибридный режим (рекомендуется)
TRANSLATION_PROVIDER=hybrid

# DeepL API Key (для fallback)
DEEPL_API_KEY=твой-deepl-ключ:fx

# OpenRouter API
OPENROUTER_API_KEY=sk-or-v1-твой-ключ-здесь
OPENROUTER_MODEL=google/gemma-4-31b-it:free
```

### 3. Запусти

```bash
npm run dev
```

---

## Как работает гибридная система

```
┌─────────────────────────────────────────┐
│  Пользователь загружает файл           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Translator (hybrid mode)               │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ OpenRouter?   │
       └───────┬───────┘
               │
        ┌──────┴──────┐
        │             │
       ДА            НЕТ
        │             │
        ▼             ▼
┌──────────────┐  ┌──────────────┐
│ OpenRouter   │  │ DeepL        │
│ (бесплатно)  │  │ (fallback)   │
└──────┬───────┘  └──────────────┘
       │
   ┌───┴────┐
   │        │
 Успех   Ошибка
   │        │
   ▼        ▼
 Готово  DeepL
```

**Логика:**
1. Пробует OpenRouter (бесплатная модель Gemma 4 31B)
2. При ошибке автоматически переключается на DeepL
3. Запоминает что OpenRouter упал → дальше использует DeepL
4. При перезапуске сервера снова пробует OpenRouter

---

## Режимы работы

### Hybrid (рекомендуется)

```env
TRANSLATION_PROVIDER=hybrid
```

- Пробует OpenRouter → при ошибке DeepL
- Автоматическое переключение
- Максимальная надёжность

### OpenRouter only

```env
TRANSLATION_PROVIDER=openrouter
```

- Только OpenRouter
- Упадёт при ошибке OpenRouter

### DeepL only

```env
TRANSLATION_PROVIDER=deepl
```

- Только DeepL
- Как было раньше

---

## Логирование

Система выводит подробные логи в консоль:

```
🔧 [Translator] Initializing with provider: hybrid
✅ [Translator] OpenRouter configured with model: google/gemma-4-31b-it:free
🚀 [Translator] Attempting translation with OpenRouter...
🤖 [OpenRouter] Translating with model: google/gemma-4-31b-it:free
📝 [OpenRouter] Text length: 13 chars
✅ [OpenRouter] Translation successful (1234ms)
📊 [OpenRouter] Result length: 15 chars
✅ [Translator] OpenRouter translation successful
```

При ошибке:

```
⚠️ [Translator] OpenRouter failed, falling back to DeepL
   Error: OpenRouter API error: 429 - Rate limit exceeded
🔄 [Translator] Switching to DeepL...
✅ [Translator] DeepL translation successful
```

---

## Бесплатные модели OpenRouter

| Модель | Качество | Скорость | Рекомендация |
|--------|----------|----------|--------------|
| `google/gemma-4-31b-it:free` | ⭐⭐⭐⭐ | Быстро | ✅ По умолчанию |
| `deepseek/deepseek-chat` | ⭐⭐⭐⭐ | Быстро | ✅ Альтернатива |
| `google/gemini-flash-1.5` | ⭐⭐⭐⭐ | Очень быстро | ✅ Для скорости |
| `qwen/qwen-2.5-72b-instruct` | ⭐⭐⭐⭐⭐ | Средне | ✅ Лучшее качество |

Чтобы сменить модель:

```env
OPENROUTER_MODEL=deepseek/deepseek-chat
```

---

## Тестирование

```bash
# Запустить тесты OpenRouter и Translator
npm test -- openrouter.test.ts translator.test.ts

# Все тесты
npm test
```

**Покрытие:**
- ✅ OpenRouter API клиент (24 теста)
- ✅ Гибридная система (20 тестов)
- ✅ Автоматический fallback
- ✅ Batch перевод
- ✅ Логирование

---

## Устранение неполадок

### ❌ `OPENROUTER_API_KEY not set in .env`

Добавь ключ в `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-твой-ключ
```

### ❌ OpenRouter возвращает 402 (Insufficient credits)

Бесплатные модели не требуют кредитов. Проверь что используешь модель с суффиксом `:free`:

```env
OPENROUTER_MODEL=google/gemma-4-31b-it:free
```

### ❌ OpenRouter возвращает 429 (Rate limit)

Система автоматически переключится на DeepL. Подожди несколько минут и перезапусти сервер.

### ⚠️ Качество перевода хуже чем DeepL

LLM модели иногда "додумывают" вместо точного перевода. Попробуй:

1. Сменить модель на `qwen/qwen-2.5-72b-instruct` (лучшее качество)
2. Использовать `TRANSLATION_PROVIDER=deepl` для критичных переводов

---

## Сравнение DeepL vs OpenRouter

| Параметр | DeepL | OpenRouter (Gemma 4) |
|----------|-------|----------------------|
| **Цена** | $5/500K символов | Бесплатно |
| **Лимит** | 500K символов/месяц | Неограниченно |
| **Качество** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Скорость** | Очень быстро | Быстро |
| **Контекст** | Нет | Да (игровая терминология) |

**Вывод:** OpenRouter дешевле и гибче, DeepL точнее для простых переводов.

---

## Файлы

- `lib/openrouter.ts` — OpenRouter API клиент
- `lib/translator.ts` — Гибридная система
- `__tests__/lib/openrouter.test.ts` — Тесты OpenRouter
- `__tests__/lib/translator.test.ts` — Тесты гибридной системы

---

**Дата:** 08.05.2026  
**Версия:** 3.17.0+
