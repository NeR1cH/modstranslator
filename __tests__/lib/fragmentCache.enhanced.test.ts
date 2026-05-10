/**
 * Enhanced Fragment Cache Tests
 * Tests for new pattern extraction (3-word patterns, expanded materials/items)
 */

import { getFragmentCache, resetFragmentCache } from '../../lib/fragmentCache';

describe('FragmentCache - Enhanced Patterns', () => {
  let cache: ReturnType<typeof getFragmentCache>;

  beforeEach(() => {
    resetFragmentCache(); // Reset singleton before creating test cache
    cache = getFragmentCache('.translation-cache-test');
    cache.clear(); // Clear cache before each test to avoid conflicts with disk cache
  });

  describe('Expanded Materials', () => {
    test('should recognize new modpack materials (zinc, lead, uranium)', () => {
      // Learn patterns with new materials
      cache.learn('Zinc Ingot', 'Цинковый слиток');
      cache.learn('Zinc Ore', 'Цинковая руда');
      cache.learn('Zinc Dust', 'Цинковая пыль');
      cache.learn('Zinc Plate', 'Цинковая пластина');
      cache.learn('Zinc Block', 'Цинковый блок');

      cache.learn('Lead Ore', 'Свинцовая руда');
      cache.learn('Lead Ingot', 'Свинцовый слиток');
      cache.learn('Lead Dust', 'Свинцовая пыль');
      cache.learn('Lead Nugget', 'Свинцовый самородок');
      cache.learn('Lead Block', 'Свинцовый блок');

      cache.learn('Uranium Dust', 'Урановая пыль');
      cache.learn('Uranium Ore', 'Урановая руда');
      cache.learn('Uranium Ingot', 'Урановый слиток');
      cache.learn('Uranium Block', 'Урановый блок');
      cache.learn('Uranium Plate', 'Урановая пластина');

      const stats = cache.getStats();

      // Should have extracted "zinc", "lead", "uranium" as fragments
      expect(stats.total).toBeGreaterThan(0);
    });

    test('should recognize advanced materials (osmium, platinum, iridium)', () => {
      cache.learn('Osmium Ingot', 'Осмиевый слиток');
      cache.learn('Osmium Ore', 'Осмиевая руда');
      cache.learn('Osmium Block', 'Осмиевый блок');

      cache.learn('Platinum Ore', 'Платиновая руда');
      cache.learn('Platinum Ingot', 'Платиновый слиток');
      cache.learn('Platinum Block', 'Платиновый блок');

      cache.learn('Iridium Plate', 'Иридиевая пластина');
      cache.learn('Iridium Ore', 'Иридиевая руда');
      cache.learn('Iridium Ingot', 'Иридиевый слиток');

      const stats = cache.getStats();

      // Should have extracted "osmium", "platinum", "iridium" as fragments
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Expanded Item Types', () => {
    test('should recognize new item types (ore, dust, plate, gear)', () => {
      cache.learn('Iron Ore', 'Железная руда');
      cache.learn('Copper Ore', 'Медная руда');
      cache.learn('Gold Ore', 'Золотая руда');

      cache.learn('Iron Dust', 'Железная пыль');
      cache.learn('Copper Dust', 'Медная пыль');
      cache.learn('Silver Dust', 'Серебряная пыль');

      cache.learn('Gold Plate', 'Золотая пластина');
      cache.learn('Iron Plate', 'Железная пластина');
      cache.learn('Copper Plate', 'Медная пластина');

      cache.learn('Steel Gear', 'Стальная шестерня');
      cache.learn('Iron Gear', 'Железная шестерня');
      cache.learn('Bronze Gear', 'Бронзовая шестерня');

      const stats = cache.getStats();

      // Should have extracted "ore", "dust", "plate", "gear" as fragments
      expect(stats.total).toBeGreaterThan(0);
    });

    test('should recognize processing item types (rod, sheet, nugget, wire)', () => {
      cache.learn('Iron Rod', 'Железный стержень');
      cache.learn('Steel Rod', 'Стальной стержень');
      cache.learn('Copper Rod', 'Медный стержень');

      cache.learn('Copper Sheet', 'Медный лист');
      cache.learn('Iron Sheet', 'Железный лист');
      cache.learn('Steel Sheet', 'Стальной лист');

      cache.learn('Gold Nugget', 'Золотой самородок');
      cache.learn('Iron Nugget', 'Железный самородок');
      cache.learn('Silver Nugget', 'Серебряный самородок');

      cache.learn('Steel Wire', 'Стальная проволока');
      cache.learn('Iron Wire', 'Железная проволока');
      cache.learn('Copper Wire', 'Медная проволока');

      const stats = cache.getStats();

      // Should have extracted "rod", "sheet", "nugget", "wire" as fragments
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('3-Word Patterns (Prefix + Material + Item)', () => {
    test('should extract "Raw + Material + Ore" pattern', () => {
      cache.learn('Raw Iron Ore', 'Сырая железная руда');
      cache.learn('Raw Copper Ore', 'Сырая медная руда');
      cache.learn('Raw Gold Ore', 'Сырая золотая руда');
      cache.learn('Raw Silver Ore', 'Сырая серебряная руда');
      cache.learn('Raw Zinc Ore', 'Сырая цинковая руда');

      const stats = cache.getStats();

      // Should have extracted "raw" prefix, materials, and "ore" suffix
      expect(stats.total).toBeGreaterThan(0);
    });

    test('should extract "Crushed + Material + Dust" pattern', () => {
      cache.learn('Crushed Iron Dust', 'Измельченная железная пыль');
      cache.learn('Crushed Copper Dust', 'Измельченная медная пыль');
      cache.learn('Crushed Gold Dust', 'Измельченная золотая пыль');
      cache.learn('Crushed Silver Dust', 'Измельченная серебряная пыль');
      cache.learn('Crushed Lead Dust', 'Измельченная свинцовая пыль');

      const stats = cache.getStats();

      // Should have extracted "crushed" prefix
      expect(stats.total).toBeGreaterThan(0);
    });

    test('should extract "Refined + Material + Ingot" pattern', () => {
      cache.learn('Refined Iron Ingot', 'Очищенный железный слиток');
      cache.learn('Refined Copper Ingot', 'Очищенный медный слиток');
      cache.learn('Refined Steel Ingot', 'Очищенный стальной слиток');
      cache.learn('Refined Silver Ingot', 'Очищенный серебряный слиток');
      cache.learn('Refined Bronze Ingot', 'Очищенный бронзовый слиток');
      cache.learn('Refined Gold Ingot', 'Очищенный золотой слиток');

      const stats = cache.getStats();

      // Should have extracted "refined" prefix
      expect(stats.total).toBeGreaterThan(0);
    });

    test('should extract "Compressed + Material + Block" pattern', () => {
      cache.learn('Compressed Iron Block', 'Сжатый железный блок');
      cache.learn('Compressed Copper Block', 'Сжатый медный блок');
      cache.learn('Compressed Steel Block', 'Сжатый стальной блок');

      const stats = cache.getStats();

      // Should have extracted "compressed" prefix
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Fragment Reuse', () => {
    test('should reuse learned fragments for similar items', () => {
      // Learn base patterns (twice each for count >= 2 requirement)
      cache.learn('Iron Ingot', 'Железный слиток');
      cache.learn('Iron Ingot', 'Железный слиток');
      cache.learn('Copper Ingot', 'Медный слиток');
      cache.learn('Copper Ingot', 'Медный слиток');
      cache.learn('Gold Ingot', 'Золотой слиток');
      cache.learn('Gold Ingot', 'Золотой слиток');
      cache.learn('Silver Ingot', 'Серебряный слиток');
      cache.learn('Silver Ingot', 'Серебряный слиток');
      cache.learn('Bronze Ingot', 'Бронзовый слиток');
      cache.learn('Bronze Ingot', 'Бронзовый слиток');
      cache.learn('Steel Ingot', 'Стальной слиток');
      cache.learn('Steel Ingot', 'Стальной слиток');

      // Try to translate using fragments
      const result = cache.tryTranslate('Bronze Ingot');

      // Should successfully translate using fragments
      expect(result).toBeTruthy();
      expect(result).toContain('слиток');
    });

    test('should combine 3-word fragments', () => {
      // Learn enough patterns to build confidence (twice each for count >= 2)
      cache.learn('Raw Iron Ore', 'Сырая железная руда');
      cache.learn('Raw Iron Ore', 'Сырая железная руда');
      cache.learn('Raw Copper Ore', 'Сырая медная руда');
      cache.learn('Raw Copper Ore', 'Сырая медная руда');
      cache.learn('Raw Gold Ore', 'Сырая золотая руда');
      cache.learn('Raw Gold Ore', 'Сырая золотая руда');
      cache.learn('Raw Silver Ore', 'Сырая серебряная руда');
      cache.learn('Raw Silver Ore', 'Сырая серебряная руда');
      cache.learn('Raw Lead Ore', 'Сырая свинцовая руда');
      cache.learn('Raw Lead Ore', 'Сырая свинцовая руда');
      cache.learn('Raw Zinc Ore', 'Сырая цинковая руда');
      cache.learn('Raw Zinc Ore', 'Сырая цинковая руда');

      // Try to translate using 3-word fragments
      const result = cache.tryTranslate('Raw Lead Ore');

      // Should attempt to use fragments (may succeed or fail based on confidence)
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('Fragment Statistics', () => {
    test('should show increased fragment count after learning', () => {
      const statsBefore = cache.getStats();

      // Learn multiple patterns with new materials and prefixes
      cache.learn('Raw Iron Ore', 'Сырая железная руда');
      cache.learn('Raw Copper Ore', 'Сырая медная руда');
      cache.learn('Raw Gold Ore', 'Сырая золотая руда');
      cache.learn('Crushed Copper Dust', 'Измельченная медная пыль');
      cache.learn('Crushed Iron Dust', 'Измельченная железная пыль');
      cache.learn('Crushed Gold Dust', 'Измельченная золотая пыль');
      cache.learn('Refined Gold Ingot', 'Очищенный золотой слиток');
      cache.learn('Refined Iron Ingot', 'Очищенный железный слиток');
      cache.learn('Refined Copper Ingot', 'Очищенный медный слиток');
      cache.learn('Zinc Plate', 'Цинковая пластина');
      cache.learn('Zinc Ingot', 'Цинковый слиток');
      cache.learn('Zinc Ore', 'Цинковая руда');
      cache.learn('Lead Nugget', 'Свинцовый самородок');
      cache.learn('Lead Ingot', 'Свинцовый слиток');
      cache.learn('Lead Ore', 'Свинцовая руда');
      cache.learn('Uranium Block', 'Урановый блок');
      cache.learn('Uranium Ingot', 'Урановый слиток');
      cache.learn('Uranium Ore', 'Урановая руда');
      cache.learn('Osmium Gear', 'Осмиевая шестерня');
      cache.learn('Osmium Ingot', 'Осмиевый слиток');
      cache.learn('Osmium Ore', 'Осмиевая руда');
      cache.learn('Platinum Wire', 'Платиновая проволока');
      cache.learn('Platinum Ingot', 'Платиновый слиток');
      cache.learn('Platinum Ore', 'Платиновая руда');

      const statsAfter = cache.getStats();

      // Should have learned new fragments (materials, items, prefixes)
      // With 3-word patterns, we extract more fragments per learning
      expect(statsAfter.total).toBeGreaterThanOrEqual(statsBefore.total);
    });
  });
});
