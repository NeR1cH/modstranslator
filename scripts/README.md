# Scripts - MOD_TRANSLATOR

Вспомогательные скрипты для разработки и обслуживания проекта.

---

## 📦 Извлечение фрагментов

### extract-from-russian.js ⭐ (Рекомендуется)
Извлекает фрагменты из существующего translation cache путем анализа русских переводов.

**Использование:**
```bash
node scripts/extract-from-russian.js
```

**Что делает:**
- Читает `.translation-cache/cache-v1.json`
- Анализирует русские переводы на паттерны (прилагательное + существительное)
- Извлекает фрагменты без оригинального английского текста
- Сохраняет в `.translation-cache/fragments-v1.json`

**Результат:**
- 27 фрагментов из 12,560 переводов
- Все с высокой уверенностью (≥80%)

---

### extract-from-files.js
Извлекает фрагменты из оригинальных и переведенных файлов.

**Использование:**
```bash
node scripts/extract-from-files.js <original.zip> <translated.zip>
```

**Что делает:**
- Читает оригинальный и переведенный ZIP/JAR
- Находит пары en_us ↔ ru_ru (JSON, LANG, SNBT)
- Извлекает фрагменты из пар оригинал+перевод
- Сохраняет в `.translation-cache/fragments-v1.json`

**Примечание:** Требует переведенные моды с ru_ru файлами внутри JAR.

---

### extract-fragments.js (Устаревший)
Первая версия скрипта для извлечения фрагментов из translation cache.

**Проблема:** Не работает, т.к. старый cache имеет `original: ''` (пустое).

**Статус:** Оставлен для истории, используйте `extract-from-russian.js` вместо него.

---

## 🛠️ Утилиты разработки

### dev-menu.bat
Интерактивное меню для разработки (Windows).

**Опции:**
1. Запустить dev-сервер
2. Запустить тесты
3. Запустить тесты с покрытием
4. Запустить dev-сервер с тестами
5. Очистить порты и запустить
6. Выход

---

### start-with-tests.bat
Запускает тесты, затем dev-сервер.

```bash
scripts\start-with-tests.bat
```

---

### start-with-auto-fix.bat
Очищает порты 3000-3003 и запускает dev-сервер.

```bash
scripts\start-with-auto-fix.bat
```

---

### run-tests.bat
Запускает все тесты.

```bash
scripts\run-tests.bat
```

---

### add-to-path.ps1
Добавляет скрипты в PATH (PowerShell).

```powershell
.\scripts\add-to-path.ps1
```

---

### d.bat
Быстрый запуск dev-сервера.

```bash
d
```

---

## 📝 Примечания

- Все скрипты извлечения фрагментов сохраняют результат в `.translation-cache/fragments-v1.json`
- После извлечения фрагментов нужно перезапустить dev-сервер
- Для проверки статистики: `curl http://localhost:3000/api/fragment-stats`
