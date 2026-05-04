# 🎉 MOD_TRANSLATOR v3.11.0 - Major Feature Update

## 🚀 Основные изменения

### ✨ Новые функции

#### 1. Поддержка вложенных JAR файлов в модпаках
- Автоматическая обработка JAR файлов модов внутри ZIP модпаков
- Извлечение → перевод → упаковка обратно
- Протестировано на модпаке с **268 JAR файлами**
- Каждый мод получает свой `ru_ru.json` файл

#### 2. Исправление FTB Quests
- Исправлен regex для распознавания всех форматов ID (`/[A-Za-z0-9]+/`)
- Добавлен пропуск русских файлов (защита от перезаписи)
- Теперь все квесты переводятся корректно

#### 3. Улучшенная структура проекта
- Добавлены папки `/tmp` и `/exports`
- Обновлен `.gitignore`
- Очистка временных файлов

#### 4. Создан ROADMAP.md
- План развития проекта с 10 предложениями улучшений
- Приоритизация и оценка времени
- Разделение на 3 фазы развития

## 📊 Результаты тестирования

**Модпак servers.zip (1015 MB):**
- ✅ JAR файлов обработано: **268**
- ✅ Переведено строк: **10,744**
- ✅ Использовано API: **320,171 символов** (75.6% лимита)
- ✅ Кэш переводов: **1,816 → 12,560 записей** (+10,744)
- ✅ Кэш фрагментов: **138 записей**
- ✅ Время обработки: ~7-10 минут

**Проверенные моды (случайная выборка):**
- ✅ alexscaves-2.0.10.jar - ru_ru.json присутствует
- ✅ create-1.20.1-0.5.1.i.jar - ru_ru.json присутствует
- ✅ farmersdelight-1.20.1-1.2.5.jar - ru_ru.json присутствует
- ✅ sophisticatedbackpacks-1.20.1-3.20.17.1150.jar - ru_ru.json присутствует

## 🎯 Возможности версии 3.11.0

### Перевод файлов
- ✅ JAR файлы модов (1.13+ и до 1.13)
- ✅ ZIP модпаки с вложенными JAR
- ✅ FTB Quests (SNBT)
- ✅ JSON lang файлы (flat и nested)
- ✅ LANG файлы (старый формат)
- ✅ TOML, CFG, XML конфиги
- ✅ Properties файлы
- ✅ TXT файлы

### Производительность
- ✅ Кэширование переводов (экономия до 70% API)
- ✅ Кэш фрагментов (умное переиспользование)
- ✅ Streaming для больших файлов (SSE)
- ✅ Поддержка файлов до 1.5 GB
- ✅ Batch processing

### UX/UI
- ✅ Drag & drop загрузка
- ✅ Real-time прогресс
- ✅ История переводов (localStorage)
- ✅ Детальные отчеты
- ✅ Темная/светлая тема
- ✅ Индикаторы API и кэша
- ✅ Отмена операции
- ✅ Скачивание по отдельности или архивом

### Безопасность
- ✅ CSRF защита
- ✅ Rate limiting (20 req/min)
- ✅ Path traversal защита
- ✅ Prototype pollution защита
- ✅ Валидация размера файлов
- ✅ Security headers (CSP, X-Frame-Options)

## 📋 Документация

- 📖 [README.md](https://github.com/NeR1cH/modstranslator/blob/main/README.md) - Полная документация
- 📝 [CHANGELOG.md](https://github.com/NeR1cH/modstranslator/blob/main/CHANGELOG.md) - История изменений
- 🗺️ [ROADMAP.md](https://github.com/NeR1cH/modstranslator/blob/main/ROADMAP.md) - План развития
- 📊 [SESSION_STATE.md](https://github.com/NeR1cH/modstranslator/blob/main/SESSION_STATE.md) - Текущее состояние

## 🚀 Быстрый старт

### 1. Установка

```bash
git clone https://github.com/NeR1cH/modstranslator.git
cd modstranslator
npm install
```

### 2. Настройка

```bash
# Создать .env файл
cp .env.example .env

# Добавить DeepL API ключ в .env
DEEPL_API_KEY=ваш_ключ_здесь
```

### 3. Запуск

```bash
npm run dev
# Откроется на http://localhost:3000
```

## 📦 Что нового в этой версии

### Изменённые файлы
- `lib/modpackProcessor.ts` - обработка вложенных JAR, пропуск ru_ru
- `lib/langParsers.ts` - исправление regex для FTB Quests
- `README.md` - обновление версии и описания
- `CHANGELOG.md` - добавлена секция 3.11.0
- `package.json` - версия 3.11.0
- `.gitignore` - добавлены tmp/ и exports/

### Новые файлы
- `ROADMAP.md` - план развития проекта
- `tmp/` - папка для временных файлов
- `exports/` - папка для экспортов

## 🔄 Обновление с предыдущей версии

```bash
git pull origin main
npm install
```

Все изменения обратно совместимы. Кэш переводов сохраняется.

## 🐛 Известные ограничения

- Максимальный размер файла: 1.5 GB
- DeepL Free лимит: 500,000 символов/месяц
- Rate limiting: 20 запросов/минуту на IP
- Направление перевода: только English → Russian

## 🎯 Следующие улучшения

См. [ROADMAP.md](https://github.com/NeR1cH/modstranslator/blob/main/ROADMAP.md) для полного плана развития.

**Приоритеты:**
1. 🔴 Unit и Integration тесты (критично)
2. 🟠 Оптимизация производительности (streaming ZIP, worker threads)
3. 🟠 Улучшенная обработка ошибок
4. 🟡 Мультиязычность интерфейса
5. 🟡 Дополнительные форматы (YAML, INI, PO, CSV)

## 💬 Обратная связь

Нашли баг или есть предложение? Создайте [Issue](https://github.com/NeR1cH/modstranslator/issues)!

## 📄 Лицензия

Apache License 2.0 - см. [LICENSE](https://github.com/NeR1cH/modstranslator/blob/main/LICENSE)

---

**Версия:** 3.11.0  
**Дата релиза:** 04.05.2026  
**Статус:** ✅ Production Ready
