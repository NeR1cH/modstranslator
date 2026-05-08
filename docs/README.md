# 📚 Документация MOD_TRANSLATOR

**Версия:** 3.16.0  
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

### 🚀 Релизы

| Версия | Дата | Описание |
|--------|------|----------|
| [v3.16.0](./releases/v3.16.0.md) | 08.05.2026 | Word-Based Translation System |
| [v3.15.1](./releases/v3.15.1.md) | 06.05.2026 | Translation Cache Fix |

📋 [Полный список релизов](./releases/README.md)

### 📦 Архив

| Раздел | Описание |
|--------|----------|
| [Сессии](./archive/sessions/) | Отчёты о рабочих сессиях |
| [Отчёты](./archive/reports/) | Технические отчёты и исследования |

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
| Версия | 3.16.0 |
| Тестов | 452 (все проходят) |
| Покрытие | 75%+ |
| Модулей | 13 |
| Кэшей | 4 (Translation, Fragment, Template, Word) |

---

## 🎯 Основные возможности

- 🤖 Автоматический перевод модов и модпаков Minecraft
- 💾 4-уровневая система кэширования
- 🧠 Word-Based Translation System с морфологией
- 📝 Грамматическое согласование (род, число, падеж)
- 🔁 Автоматическое обучение из DeepL переводов
- 📦 Поддержка 11 форматов файлов
- 🔐 Безопасность (CSRF, rate limiting, валидация)

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

### История версий

- **[v3.16.0](./releases/v3.16.0.md)** (08.05.2026) - Word-Based Translation System
  - 7 новых компонентов
  - 158 новых тестов
  - Морфологическое согласование
  - Автоматическое обучение

- **[v3.15.1](./releases/v3.15.1.md)** (06.05.2026) - Translation Cache Fix
  - Исправлен кэш переводов
  - Добавлено хранение оригинального текста

### Архив

- **[Сессии 2026-05-08](./archive/sessions/2026-05-08/)** - Реализация Word-Based System
- **[Сессии 2026-05-06](./archive/sessions/2026-05-06/)** - Translation Cache Fix
- **[Отчёты](./archive/reports/)** - Технические отчёты и исследования

---

## 🔗 Полезные ссылки

- [GitHub Repository](https://github.com/your-repo/modstranslator)
- [DeepL API](https://www.deepl.com/pro-api)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 📝 Соглашения

### Структура документации

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
├── releases/                    # Релизы по версиям
│   ├── README.md
│   ├── v3.16.0.md
│   └── v3.15.1.md
│
└── archive/                     # Архив
    ├── sessions/                # Отчёты о сессиях
    └── reports/                 # Технические отчёты
```

### Правила именования

- **Релизы:** `vX.Y.Z.md` (например, `v3.16.0.md`)
- **Сессии:** `SESSION_SUMMARY_YYYY-MM-DD.md`
- **Отчёты:** `НАЗВАНИЕ_ОТЧЁТА.md` (UPPERCASE)

### Обновление документации

1. **При новом релизе:**
   - Создай `docs/releases/vX.Y.Z.md`
   - Обнови `docs/CHANGELOG.md`
   - Обнови `docs/releases/README.md`
   - Обнови этот файл (таблицу релизов)

2. **После рабочей сессии:**
   - Создай `docs/archive/sessions/YYYY-MM-DD/SESSION_SUMMARY.md`
   - Обнови `docs/SESSION_STATE.md`

3. **При добавлении новой системы:**
   - Создай `docs/architecture/НАЗВАНИЕ_СИСТЕМЫ.md`
   - Обнови этот файл (таблицу архитектуры)

---

## 🆘 Помощь

Если не можешь найти нужную информацию:

1. Проверь [CHANGELOG.md](./CHANGELOG.md) - возможно, это было недавно изменено
2. Посмотри [SESSION_STATE.md](./SESSION_STATE.md) - текущее состояние проекта
3. Загляни в [архив сессий](./archive/sessions/) - подробные отчёты о работе

---

**Последнее обновление:** 08.05.2026  
**Версия документации:** 1.0
