# 📚 Документация MOD_TRANSLATOR

**Версия:** 3.17.1  
**Дата:** 08.05.2026  
**Статус:** ✅ Production Ready

---

## 🗂️ Навигация по документации

### 📖 Основные документы

| Документ | Описание |
|----------|----------|
| [CHANGELOG.md](./CHANGELOG.md) | История всех изменений проекта |
| [ROADMAP.md](./ROADMAP.md) | План развития и приоритеты |
| [SESSION_STATE.md](./SESSION_STATE.md) | Текущее состояние проекта |

### 🏗️ Архитектура

| Документ | Описание |
|----------|----------|
| [WORD_BASED_SYSTEM.md](./architecture/WORD_BASED_SYSTEM.md) | Word-Based Translation System (v3.16.0) |
| [PROJECT_STRUCTURE.md](./architecture/PROJECT_STRUCTURE.md) | Структура проекта |
| [Cache System](./architecture/cache-system/) | Система кэширования |

### 📖 Руководства

| Документ | Описание |
|----------|----------|
| [OPENROUTER_GUIDE.md](./guides/OPENROUTER_GUIDE.md) | Руководство по интеграции OpenRouter |

### 🚀 Релизы

| Версия | Дата | Описание |
|--------|------|----------|
| [v3.17.1](./releases/v3.17.1.md) | 08.05.2026 | Cache Fixes ⭐ |
| [v3.17.0](./releases/v3.17.0.md) | 08.05.2026 | OpenRouter + Morphological System |
| [v3.16.0](./releases/v3.16.0.md) | 08.05.2026 | Word-Based Translation System |
| [v3.15.1](./releases/v3.15.1.md) | 06.05.2026 | Translation Cache Fix |

📋 [Полный список релизов](./releases/README.md)

### 📦 Архив

| Раздел | Описание |
|--------|----------|
| [Сессии](./archive/sessions/) | Отчёты о рабочих сессиях |
| [Отчёты](./archive/reports/) | Технические отчёты и исследования |
| [План завершён](./archive/PLAN_COMPLETION_SUMMARY.md) | Сводка завершения плана улучшенной системы |

---

## 🚀 Быстрый старт

### Для пользователей

1. **Установка:**
   ```bash
   npm install
   ```

2. **Настройка:**
   - Создай `.env` файл
   - Добавь `DEEPL_API_KEY=твой_ключ`
   - (Опционально) Добавь `OPENROUTER_API_KEY=твой_ключ`

3. **Запуск:**
   ```bash
   npm run dev
   ```

4. **Открой:** http://localhost:3000

### Для разработчиков

1. **Тесты:**
   ```bash
   npm test              # Все тесты
   npm run test:watch    # Watch mode
   npm run test:coverage # С покрытием
   ```

2. **Сборка:**
   ```bash
   npm run build
   npm start
   ```

3. **Документация:**
   - Читай [CHANGELOG.md](./CHANGELOG.md) перед началом работы
   - Проверяй [SESSION_STATE.md](./SESSION_STATE.md) для текущего состояния
   - Следуй [ROADMAP.md](./ROADMAP.md) для приоритетов

---

## 📊 Текущее состояние

| Метрика | Значение |
|---------|----------|
| Версия | 3.17.1 |
| Тестов | 479 (все проходят) |
| Покрытие | 75%+ |
| Модулей | 17 |
| Кэшей | 4 (Translation, Fragment, Template, Word) |
| OpenRouter | openai/gpt-oss-120b:free |

---

## 🎯 Основные возможности

- 🤖 Автоматический перевод модов и модпаков Minecraft
- 🔄 Гибридная система: OpenRouter (primary) → DeepL (fallback)
- 💾 4-уровневая система кэширования
- 🧠 Word-Based Translation System с морфологией
- 📝 Грамматическое согласование (род, число, падеж)
- 🔁 Автоматическое обучение из переводов
- 📦 Поддержка 11 форматов файлов
- 🔐 Безопасность (CSRF, rate limiting, валидация)
- 🛑 Graceful shutdown при недоступности провайдеров

---

## 📖 Подробная документация

### Архитектура

- **[Word-Based System](./architecture/WORD_BASED_SYSTEM.md)** - Пословный перевод с морфологией
  - WordCache - кэш переводов слов
  - SentenceSplitter - токенизация и POS tagging
  - NumberResolver - определение чисел
  - AgreementEngine - морфологическое согласование
  - TemplateCache - кэш шаблонов предложений
  - GrammarAssembler - сборка предложений
  - WordBasedTranslator - главный модуль

- **[Cache System](./architecture/cache-system/)** - Система кэширования
  - TranslationCache - кэш полных переводов
  - FragmentCache - кэш фрагментов (материалы + предметы)
  - TemplateCache - кэш шаблонов
  - WordCache - кэш слов

- **[Project Structure](./architecture/PROJECT_STRUCTURE.md)** - Структура проекта

### Руководства

- **[OpenRouter Guide](./guides/OPENROUTER_GUIDE.md)** - Интеграция OpenRouter API
  - Настройка и конфигурация
  - Выбор моделей
  - Гибридный режим
  - Troubleshooting

### История версий

- **[v3.17.1](./releases/v3.17.1.md)** (08.05.2026) - Cache Fixes
  - Исправлен вывод статистики
  - Добавлен flush() для кэшей
  - Детальное логирование

- **[v3.17.0](./releases/v3.17.0.md)** (08.05.2026) - OpenRouter + Morphological System
  - OpenRouter integration
  - Morphological translation system
  - 65 новых тестов

- **[v3.16.0](./releases/v3.16.0.md)** (08.05.2026) - Word-Based Translation System
  - 7 новых компонентов
  - 158 новых тестов
  - Морфологическое согласование

### Архив

- **[План завершён](./archive/PLAN_COMPLETION_SUMMARY.md)** - Сводка реализации улучшенной системы
- **[Сессии](./archive/sessions/)** - Отчёты о рабочих сессиях
- **[Отчёты](./archive/reports/)** - Технические отчёты и исследования

---

## 🔗 Полезные ссылки

- [GitHub Repository](https://github.com/NeR1cH/modstranslator)
- [Releases](https://github.com/NeR1cH/modstranslator/releases)
- [DeepL API](https://www.deepl.com/pro-api)
- [OpenRouter API](https://openrouter.ai/)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 📝 Структура документации

```
docs/
├── README.md                    # Этот файл - навигация
├── CHANGELOG.md                 # История изменений
├── ROADMAP.md                   # План развития
├── SESSION_STATE.md             # Текущее состояние
│
├── architecture/                # Архитектура и системы
│   ├── WORD_BASED_SYSTEM.md
│   ├── PROJECT_STRUCTURE.md
│   └── cache-system/
│
├── guides/                      # Руководства
│   └── OPENROUTER_GUIDE.md
│
├── releases/                    # Релизы по версиям
│   ├── README.md
│   ├── v3.17.1.md
│   ├── v3.17.0.md
│   └── ...
│
└── archive/                     # Архив
    ├── PLAN_COMPLETION_SUMMARY.md
    ├── sessions/                # Отчёты о сессиях
    └── reports/                 # Технические отчёты
```

---

## 🆘 Помощь

Если не можешь найти нужную информацию:

1. Проверь [CHANGELOG.md](./CHANGELOG.md) - возможно, это было недавно изменено
2. Посмотри [SESSION_STATE.md](./SESSION_STATE.md) - текущее состояние проекта
3. Загляни в [архив](./archive/) - подробные отчёты о работе

---

**Последнее обновление:** 08.05.2026 22:41  
**Версия документации:** 2.0
