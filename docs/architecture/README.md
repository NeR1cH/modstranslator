# 🏗️ Архитектура MOD_TRANSLATOR

Документация по архитектуре и внутренним системам проекта.

---

## 📚 Основные системы

### [Word-Based Translation System](./WORD_BASED_SYSTEM.md)

**Версия:** 3.16.0  
**Статус:** ✅ Production Ready

Универсальная система пословного перевода с морфологией и автоматическим обучением.

**Компоненты:**
- **WordCache** - кэш переводов слов с морфологическими формами
- **SentenceSplitter** - токенизация и POS tagging
- **NumberResolver** - определение чисел и множественности
- **AgreementEngine** - морфологическое согласование
- **TemplateCache** - кэш шаблонов предложений
- **GrammarAssembler** - сборка предложений с грамматикой
- **WordBasedTranslator** - главный модуль системы

**Возможности:**
- Пословный перевод с кэшированием
- Автоматическое обучение из DeepL переводов
- Морфологическое согласование (склонение, род, число)
- Падежные согласования после предлогов
- Экономия API вызовов

📖 [Полная документация](./WORD_BASED_SYSTEM.md)

---

### [Cache System](./cache-system/)

**Версия:** 3.16.0  
**Статус:** ✅ Production Ready

Многоуровневая система кэширования для максимальной экономии API вызовов.

**Компоненты:**
- **TranslationCache** - кэш полных переводов
- **FragmentCache** - кэш фрагментов (материалы + предметы)
- **TemplateCache** - кэш шаблонов предложений
- **WordCache** - кэш отдельных слов

**Возможности:**
- 4-уровневое кэширование
- Автоматическое обучение
- Грамматическое согласование
- Сохранение на диск

📖 [Полная документация](./cache-system/)

---

### [Project Structure](./PROJECT_STRUCTURE.md)

Структура файлов и папок проекта.

**Основные разделы:**
- `app/` - Next.js App Router
- `lib/` - Бизнес-логика
- `components/` - React компоненты
- `__tests__/` - Тесты

📖 [Полная документация](./PROJECT_STRUCTURE.md)

---

## 🔄 Translation Pipeline

Порядок обработки переводов:

```
1. TranslationCache
   ↓ (если не найдено)
2. FragmentCache
   ↓ (если не найдено)
3. TemplateCache
   ↓ (если не найдено)
4. WordBased ✨ NEW
   ↓ (если не найдено)
5. MorphologicalTranslate (TODO)
   ↓ (если не найдено)
6. DeepL API
```

**Преимущества:**
- Максимальное переиспользование переводов
- Минимум API вызовов
- Постепенное обучение системы
- Автоматический fallback

---

## 📊 Компоненты по категориям

### Кэширование
- `lib/translationCache.ts` - Кэш полных переводов
- `lib/fragmentCache.ts` - Кэш фрагментов
- `lib/templateCache.ts` - Кэш шаблонов
- `lib/wordCache.ts` - Кэш слов

### Перевод
- `lib/deepl.ts` - DeepL API клиент
- `lib/translationPipeline.ts` - Главный pipeline
- `lib/wordBasedTranslator.ts` - Word-based система

### Морфология
- `lib/sentenceSplitter.ts` - Токенизация
- `lib/numberResolver.ts` - Определение чисел
- `lib/agreementEngine.ts` - Согласование
- `lib/grammarAssembler.ts` - Сборка предложений
- `lib/wordLibrary.ts` - Словарь слов

### Обработка файлов
- `lib/langParsers.ts` - Парсеры форматов
- `lib/jarProcessor.ts` - Обработка JAR
- `lib/modpackProcessor.ts` - Обработка модпаков

### Безопасность
- `lib/security.ts` - Защита от атак
- `lib/rateLimiter.ts` - Rate limiting
- `lib/queueLimits.ts` - Лимиты очереди

---

## 🎯 Принципы архитектуры

### 1. Модульность
Каждый компонент независим и может использоваться отдельно.

### 2. Кэширование
Многоуровневое кэширование для максимальной экономии API.

### 3. Fallback
Автоматический переход на следующий уровень при ошибке.

### 4. Обучение
Система учится из каждого перевода.

### 5. Безопасность
Защита от всех основных типов атак.

---

## 📈 Эволюция архитектуры

### v3.15.1 и ранее
```
TranslationCache → FragmentCache → DeepL
```

### v3.16.0 (текущая)
```
TranslationCache → FragmentCache → TemplateCache → WordBased → DeepL
```

### v3.17.0 (планируется)
```
TranslationCache → FragmentCache → TemplateCache → WordBased → Morphological → DeepL
```

---

## 🔍 Детальная документация

### Word-Based System
- [Полное описание](./WORD_BASED_SYSTEM.md)
- Архитектура компонентов
- Примеры использования
- Ограничения и планы

### Cache System
- [Полное описание](./cache-system/)
- Типы кэшей
- Стратегии кэширования
- Производительность

### Project Structure
- [Полное описание](./PROJECT_STRUCTURE.md)
- Структура папок
- Соглашения об именовании
- Best practices

---

## 🔗 Связанные документы

- [Главная документация](../README.md)
- [История изменений](../CHANGELOG.md)
- [План развития](../ROADMAP.md)
- [Релизы](../releases/)

---

## 📝 Для разработчиков

### Добавление новой системы

1. Создай файл `docs/architecture/НАЗВАНИЕ_СИСТЕМЫ.md`
2. Опиши архитектуру, компоненты, примеры
3. Добавь ссылку в этот файл
4. Обнови `docs/README.md`

### Обновление существующей системы

1. Обнови соответствующий файл в `docs/architecture/`
2. Укажи версию и дату изменений
3. Добавь запись в `docs/CHANGELOG.md`

---

**Последнее обновление:** 08.05.2026  
**Версия:** 3.16.0
