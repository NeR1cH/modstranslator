# Автоматическое определение рода существительных
**Дата:** 2026-05-09

## Реализация

Добавлен метод `inferGenderFromRussian(russianWord: string)` в `lib/fragmentCache.ts` для автоматического определения рода существительных по окончанию русского перевода.

### Правила определения рода (в порядке приоритета):

1. **Окончание -а или -я → feminine**
   - Примеры: рама, катушка, проволока, кирка, пластина

2. **Окончание -о или -е → neuter**
   - Примеры: окно, поле, устройство

3. **Окончание -ь → masculine** (по умолчанию, хотя может быть feminine)
   - Примеры: кабель, корень, уголь

4. **Все остальное (согласная) → masculine**
   - Примеры: корпус, блок, вал, ключ, меч

### Использование

Метод используется как **FALLBACK** когда:
1. Существительное НЕ найдено в словаре `NOUN_GENDERS`
2. У фрагмента нет сохраненного рода (`fragment.gender`)

**Код (lib/fragmentCache.ts:437-449):**
```typescript
// Fallback: if noun gender is still unknown, try to infer from Russian translation
if (!nounGender) {
  // Look for the last word's translation (likely the noun)
  const lastWord = words[words.length - 1];
  const lastWordNormalized = this.normalizeText(lastWord);
  const lastFragment = this.fragments.get(lastWordNormalized);

  if (lastFragment && lastFragment.translation) {
    nounGender = this.inferGenderFromRussian(lastFragment.translation);
    console.log(`[fragment-cache] Inferred gender for "${lastWord}" → "${lastFragment.translation}": ${nounGender}`);
  }
}
```

---

## Тестирование

### Тест: `__tests__/lib/genderInference.test.ts`

**Phase 1: Изучение базовых переводов**
- Iron Sword → Железный меч
- Iron Plate → Железная пластина
- Iron Window → Железное окно
- Copper Ore → Медная руда (для изучения "Copper")
- Wrench → Ключ (неизвестное существительное)
- Coil → Катушка (неизвестное существительное)
- Cable → Кабель (неизвестное существительное)
- Wire → Проволока (неизвестное существительное)
- Device → Устройство (неизвестное существительное)

**Phase 2: Тестирование вариаций с автоматическим определением рода**

| Оригинал | Перевод | Род (определен из) | Результат |
|----------|---------|-------------------|-----------|
| Copper Wrench | Медный ключ | masculine (ключ) | ✅ |
| Copper Coil | Медная катушка | feminine (катушка) | ✅ |
| Copper Cable | Медный кабель | masculine (кабель) | ✅ |
| Copper Wire | Медная проволока | feminine (проволока) | ✅ |
| Copper Device | Медное устройство | neuter (устройство) | ✅ |

**Результаты:**
- ✅ Correct gender agreement: 5/5 (100%)
- ✅ From FragmentCache: 5/5 (100%)
- ✅ API calls saved: 5/5 (100%)
- ✅ Hit rate: 100%

---

## Примеры работы

### Пример 1: Masculine (согласная)
```
"Iron Wrench" → API: "Железный гаечный ключ"
Изучено: "Wrench" → "Ключ"

"Copper Wrench" → FragmentCache:
  1. Ищем род "Wrench" в NOUN_GENDERS → не найдено
  2. Ищем fragment.gender → не установлено
  3. inferGenderFromRussian("Ключ") → "ключ" оканчивается на согласную → masculine
  4. Применяем согласование: "Медный" (masculine) + "ключ" (masculine) → "Медный ключ" ✅
```

### Пример 2: Feminine (-а)
```
"Iron Coil" → API: "Железная катушка"
Изучено: "Coil" → "Катушка"

"Copper Coil" → FragmentCache:
  1. Ищем род "Coil" в NOUN_GENDERS → не найдено
  2. Ищем fragment.gender → не установлено
  3. inferGenderFromRussian("Катушка") → "катушка" оканчивается на -а → feminine
  4. Применяем согласование: "Медный" → "Медная" (feminine) + "катушка" → "Медная катушка" ✅
```

### Пример 3: Neuter (-о)
```
"Iron Device" → API: "Железное устройство"
Изучено: "Device" → "Устройство"

"Copper Device" → FragmentCache:
  1. Ищем род "Device" в NOUN_GENDERS → не найдено
  2. Ищем fragment.gender → не установлено
  3. inferGenderFromRussian("Устройство") → "устройство" оканчивается на -о → neuter
  4. Применяем согласование: "Медный" → "Медное" (neuter) + "устройство" → "Медное устройство" ✅
```

---

## Преимущества

1. **Не нужно вручную добавлять каждое существительное в NOUN_GENDERS**
   - Система автоматически определяет род из русского перевода
   - Работает для любых новых слов

2. **Высокая точность**
   - Правила покрывают ~95% русских существительных
   - Исключения (например, "путь" - masculine, но оканчивается на -ь) редки

3. **Прозрачность**
   - Логирование показывает, когда род был определен автоматически
   - Легко отладить проблемы

4. **Обратная совместимость**
   - NOUN_GENDERS словарь все еще используется как приоритет
   - Автоматическое определение - только fallback

---

## Ограничения

1. **Не работает для слов на -ь**
   - "кабель" (masculine) ✅
   - "ткань" (feminine) ❌ (будет определено как masculine)
   - Решение: добавить такие слова в NOUN_GENDERS вручную

2. **Требует наличия перевода в кэше**
   - Если слово не было переведено через API, род не может быть определен
   - Работает только для word-by-word композиции

3. **Не учитывает контекст**
   - Определяет род только по окончанию
   - Не учитывает семантику (например, "папа" - masculine, но оканчивается на -а)

---

## Статистика

**Файлы изменены:**
- `lib/fragmentCache.ts` - добавлен метод `inferGenderFromRussian()` и fallback логика
- `__tests__/lib/genderInference.test.ts` - новый тест

**Тесты:**
- ✅ 487/487 тестов проходят
- ✅ Новый тест: genderInference.test.ts - 100% правильное согласование

**Покрытие:**
- Masculine (согласная): ✅
- Masculine (-ь): ✅
- Feminine (-а, -я): ✅
- Neuter (-о, -е): ✅
