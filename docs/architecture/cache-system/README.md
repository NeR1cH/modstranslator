# Cache System Documentation

Документация по системе кэширования MOD_TRANSLATOR.

---

## 📁 Структура папок

### `/explanations` - Объяснения для новичков
- `CACHE_EXPLANATION.md` - Подробное объяснение как работает кэш и фрагменты

### `/architecture` - Техническая архитектура
- Диаграммы
- Технические спецификации
- API документация

### `/research` - Исследования и эксперименты
- Результаты тестов
- Анализ эффективности
- Эксперименты с новыми подходами

### `/agents` - Работа агентов
- Отчеты агентов
- Результаты исследований агентами
- Планы, созданные агентами

---

## 🔗 Быстрые ссылки

**Для новичков:**
- [Как работает кэш?](explanations/CACHE_EXPLANATION.md)

**Для разработчиков:**
- Translation Cache: `lib/translationCache.ts`
- Fragment Cache: `lib/fragmentCache.ts`
- Base Cache: `lib/BaseCache.ts`

**Тесты:**
- Translation Cache: `__tests__/lib/translationCache.test.ts`
- Fragment Cache: `__tests__/lib/fragmentCache.test.ts`
- Grammar: `__tests__/lib/fragmentCache.grammar.test.ts`

---

## 📊 Текущее состояние

**Версия:** 3.15.1

**Translation Cache:**
- Записей: 12,560
- Структура: `{ original, translated }` ✅
- Файл: `.translation-cache/cache-v1.json`

**Fragment Cache:**
- Фрагментов: 138 (ожидается рост до 2,000-3,000)
- Материалов: 41
- Типов предметов: 43
- Префиксов: 10
- Словарь родов: 63 слова
- Файл: `.translation-cache/fragments-v1.json`

---

**Последнее обновление:** 08.05.2026 17:38
