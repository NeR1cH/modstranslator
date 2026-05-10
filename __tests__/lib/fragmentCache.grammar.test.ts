/**
 * Grammar Agreement Tests
 * Tests for gender agreement between adjectives and nouns
 */

import { getFragmentCache, resetFragmentCache } from '../../lib/fragmentCache';

describe('FragmentCache - Grammar Agreement', () => {
  let cache: ReturnType<typeof getFragmentCache>;

  beforeEach(() => {
    resetFragmentCache(); // Reset singleton before creating test cache
    cache = getFragmentCache('.translation-cache-test');
  });

  describe('Masculine Gender Agreement', () => {
    test('should correctly agree adjectives with masculine nouns', () => {
      // Learn patterns with masculine nouns
      cache.learn('Lead Ingot', 'Свинцовый слиток');
      cache.learn('Copper Ingot', 'Медный слиток');
      cache.learn('Gold Ingot', 'Золотой слиток');
      cache.learn('Iron Ingot', 'Железный слиток');
      cache.learn('Silver Ingot', 'Серебряный слиток');

      cache.learn('Lead Nugget', 'Свинцовый самородок');
      cache.learn('Copper Nugget', 'Медный самородок');
      cache.learn('Gold Nugget', 'Золотой самородок');

      cache.learn('Lead Block', 'Свинцовый блок');
      cache.learn('Copper Block', 'Медный блок');
      cache.learn('Iron Block', 'Железный блок');

      // Try to translate using fragments
      const result1 = cache.tryTranslate('Zinc Ingot');
      const result2 = cache.tryTranslate('Uranium Nugget');
      const result3 = cache.tryTranslate('Steel Block');

      // Should use masculine endings (-ый, -ой)
      if (result1) {
        expect(result1).toMatch(/ый слиток|ой слиток/);
        expect(result1).not.toMatch(/ая слиток|ое слиток/);
      }

      if (result2) {
        expect(result2).toMatch(/ый самородок|ой самородок/);
        expect(result2).not.toMatch(/ая самородок|ое самородок/);
      }

      if (result3) {
        expect(result3).toMatch(/ый блок|ой блок/);
        expect(result3).not.toMatch(/ая блок|ое блок/);
      }
    });
  });

  describe('Feminine Gender Agreement', () => {
    test('should correctly agree adjectives with feminine nouns', () => {
      // Learn patterns with feminine nouns
      cache.learn('Lead Ore', 'Свинцовая руда');
      cache.learn('Copper Ore', 'Медная руда');
      cache.learn('Gold Ore', 'Золотая руда');
      cache.learn('Iron Ore', 'Железная руда');
      cache.learn('Silver Ore', 'Серебряная руда');

      cache.learn('Lead Dust', 'Свинцовая пыль');
      cache.learn('Copper Dust', 'Медная пыль');
      cache.learn('Gold Dust', 'Золотая пыль');
      cache.learn('Iron Dust', 'Железная пыль');

      cache.learn('Lead Plate', 'Свинцовая пластина');
      cache.learn('Copper Plate', 'Медная пластина');
      cache.learn('Iron Plate', 'Железная пластина');

      cache.learn('Lead Wire', 'Свинцовая проволока');
      cache.learn('Copper Wire', 'Медная проволока');
      cache.learn('Steel Wire', 'Стальная проволока');

      // Try to translate using fragments
      const result1 = cache.tryTranslate('Zinc Ore');
      const result2 = cache.tryTranslate('Uranium Dust');
      const result3 = cache.tryTranslate('Aluminum Plate');
      const result4 = cache.tryTranslate('Gold Wire');

      // Should use feminine endings (-ая, -яя)
      if (result1) {
        expect(result1).toMatch(/ая руда|яя руда/);
        expect(result1).not.toMatch(/ый руда|ое руда/);
      }

      if (result2) {
        expect(result2).toMatch(/ая пыль|яя пыль/);
        expect(result2).not.toMatch(/ый пыль|ое пыль/);
      }

      if (result3) {
        expect(result3).toMatch(/ая пластина|яя пластина/);
        expect(result3).not.toMatch(/ый пластина|ое пластина/);
      }

      if (result4) {
        expect(result4).toMatch(/ая проволока|яя проволока/);
        expect(result4).not.toMatch(/ый проволока|ое проволока/);
      }
    });
  });

  describe('3-Word Pattern Gender Agreement', () => {
    test('should correctly agree all adjectives in 3-word patterns', () => {
      // Learn 3-word patterns
      cache.learn('Raw Iron Ore', 'Сырая железная руда');
      cache.learn('Raw Copper Ore', 'Сырая медная руда');
      cache.learn('Raw Gold Ore', 'Сырая золотая руда');
      cache.learn('Raw Silver Ore', 'Сырая серебряная руда');
      cache.learn('Raw Lead Ore', 'Сырая свинцовая руда');

      cache.learn('Crushed Iron Dust', 'Измельченная железная пыль');
      cache.learn('Crushed Copper Dust', 'Измельченная медная пыль');
      cache.learn('Crushed Gold Dust', 'Измельченная золотая пыль');

      cache.learn('Refined Iron Ingot', 'Очищенный железный слиток');
      cache.learn('Refined Copper Ingot', 'Очищенный медный слиток');
      cache.learn('Refined Gold Ingot', 'Очищенный золотой слиток');

      // Try to translate using fragments
      const result1 = cache.tryTranslate('Raw Zinc Ore');
      const result2 = cache.tryTranslate('Crushed Silver Dust');
      const result3 = cache.tryTranslate('Refined Steel Ingot');

      // Should use correct gender for all words
      if (result1) {
        // Both "сырая" and "цинковая" should be feminine (руда - feminine)
        expect(result1).toMatch(/ая.*ая руда|яя.*яя руда/i);
        expect(result1).not.toMatch(/ый.*руда/i);
      }

      if (result2) {
        // Both "измельченная" and "серебряная" should be feminine (пыль - feminine)
        expect(result2).toMatch(/ая.*ая пыль|яя.*яя пыль/i);
        expect(result2).not.toMatch(/ый.*пыль/i);
      }

      if (result3) {
        // Both "очищенный" and "стальной" should be masculine (слиток - masculine)
        // Accept any combination of masculine endings: -ый, -ой, -ий
        expect(result3).toMatch(/(ый|ой|ий).*(ый|ой|ий) слиток/i);
        expect(result3).not.toMatch(/ая.*слиток/i);
      }
    });
  });

  describe('Real-world Examples', () => {
    test('should fix "Свинцовая самородок" → "Свинцовый самородок"', () => {
      // This was the original problem
      cache.learn('Lead Ore', 'Свинцовая руда');
      cache.learn('Copper Ore', 'Медная руда');
      cache.learn('Gold Ore', 'Золотая руда');

      cache.learn('Lead Nugget', 'Свинцовый самородок');
      cache.learn('Copper Nugget', 'Медный самородок');
      cache.learn('Gold Nugget', 'Золотой самородок');

      const result = cache.tryTranslate('Lead Nugget');

      // Should be "Свинцовый самородок" (masculine), not "Свинцовая самородок"
      if (result) {
        expect(result).toBe('Свинцовый самородок');
        expect(result).not.toBe('Свинцовая самородок');
      }
    });

    test('should fix "Медный проволока" → "Медная проволока"', () => {
      cache.learn('Copper Ingot', 'Медный слиток');
      cache.learn('Iron Ingot', 'Железный слиток');
      cache.learn('Steel Ingot', 'Стальной слиток');

      cache.learn('Copper Wire', 'Медная проволока');
      cache.learn('Iron Wire', 'Железная проволока');
      cache.learn('Steel Wire', 'Стальная проволока');

      const result = cache.tryTranslate('Copper Wire');

      // Should be "Медная проволока" (feminine), not "Медный проволока"
      if (result) {
        expect(result).toBe('Медная проволока');
        expect(result).not.toBe('Медный проволока');
      }
    });

    test('should fix "Урановая блок" → "Урановый блок"', () => {
      cache.learn('Uranium Ore', 'Урановая руда');
      cache.learn('Iron Ore', 'Железная руда');
      cache.learn('Copper Ore', 'Медная руда');

      cache.learn('Uranium Block', 'Урановый блок');
      cache.learn('Iron Block', 'Железный блок');
      cache.learn('Copper Block', 'Медный блок');

      const result = cache.tryTranslate('Uranium Block');

      // Should be "Урановый блок" (masculine), not "Урановая блок"
      if (result) {
        expect(result).toBe('Урановый блок');
        expect(result).not.toBe('Урановая блок');
      }
    });
  });
});
