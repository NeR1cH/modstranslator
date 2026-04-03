# MOD_TRANSLATOR — Minecraft Localization Engine

Автоматический переводчик модов Minecraft на русский язык через DeepL API.

## Поддерживаемые форматы

| Формат | Версия MC | Описание |
|--------|-----------|----------|
| `.jar` | 1.13+ | Современные моды — ищет `assets/*/lang/en_us.json`, добавляет `ru_ru.json` |
| `.jar` | до 1.13 | Старые моды — ищет `assets/*/lang/en_US.lang`, добавляет `ru_ru.lang` |
| `.json` | любая | Отдельный lang-файл |
| `.lang` | любая | Отдельный lang-файл |

## Быстрый старт

### 1. Установи Node.js
Скачай с https://nodejs.org (версия 18 или выше)

### 2. Получи DeepL API ключ
Зарегистрируйся на https://www.deepl.com/pro-api
Бесплатный план — 500 000 символов/месяц, ключ оканчивается на `:fx`

### 3. Настрой проект

```bash
# Распакуй архив и открой папку в терминале
cd minecraft-mod-translator

# Установи зависимости
npm install

# Создай файл с ключом (скопируй из .env.example)
copy .env.example .env        # Windows
cp .env.example .env          # Mac/Linux

# Открой .env и вставь свой ключ DeepL
DEEPL_API_KEY=твой_ключ_здесь
```

### 4. Запусти

```bash
npm run dev
```

Открой браузер: **http://localhost:3000**

## Как пользоваться

1. Перетащи `.jar` файлы модов в зону загрузки (или кликни)
2. Подожди анализа — увидишь сколько строк найдено
3. Нажми **ЗАПУСТИТЬ ПЕРЕВОД**
4. После завершения нажми **СКАЧАТЬ АРХИВ**
5. Внутри архива — готовые `.jar` файлы с добавленными `ru_ru.json`/`ru_ru.lang`

## Структура проекта

```
minecraft-mod-translator/
├── app/
│   ├── page.tsx              # Главная страница (UI)
│   ├── layout.tsx            # Layout + шрифты
│   ├── globals.css           # Стили (CRT эффект, анимации)
│   └── api/
│       ├── analyze/route.ts  # POST /api/analyze — анализ файла
│       ├── translate/route.ts # POST /api/translate — перевод
│       └── export/route.ts   # POST /api/export — создание ZIP
├── components/
│   ├── DropZone.tsx          # Зона Drag-and-Drop
│   ├── FileQueue.tsx         # Список файлов с статусами
│   ├── TerminalLog.tsx       # Лог событий в реальном времени
│   └── ProgressBar.tsx       # Ретро прогресс-бар
├── lib/
│   ├── deepl.ts              # DeepL API клиент (ТОЛЬКО сервер)
│   ├── jarProcessor.ts       # Работа с JAR файлами
│   └── langParsers.ts        # Парсеры .json и .lang форматов
├── types/
│   └── index.ts              # TypeScript типы
├── .env.example              # Пример переменных окружения
├── .env                      # Твой ключ (не коммить в git!)
└── package.json
```

## Безопасность

`DEEPL_API_KEY` хранится **только** в `.env` на сервере.
Переменная **не** имеет префикс `NEXT_PUBLIC_` — браузер никогда её не увидит.
Файл `.env` добавлен в `.gitignore`.
