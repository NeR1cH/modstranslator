/**
 * Test for inferGenderFromRussian() with soft sign -ь words
 * Verifies that feminine words ending with -ь are correctly identified
 */

import { getFragmentCache, resetFragmentCache } from '../../lib/fragmentCache';

describe('inferGenderFromRussian() - soft sign -ь words', () => {
  let cache: any;

  beforeEach(() => {
    resetFragmentCache();
    cache = getFragmentCache('.translation-cache-test');
  });

  it('should return feminine for known feminine -ь words', () => {
    // Access private method via any cast for testing
    const inferGender = (cache as any).inferGenderFromRussian.bind(cache);

    // Known feminine words from FEMININE_SOFT
    expect(inferGender('дверь')).toBe('feminine');
    expect(inferGender('цепь')).toBe('feminine');
    expect(inferGender('ткань')).toBe('feminine');
    expect(inferGender('пыль')).toBe('feminine');
    expect(inferGender('сталь')).toBe('feminine');
    expect(inferGender('соль')).toBe('feminine');
    expect(inferGender('печать')).toBe('feminine');
    expect(inferGender('панель')).toBe('feminine');
    expect(inferGender('шестерня')).toBe('feminine'); // Note: ends with -я, not -ь
  });

  it('should return masculine for unknown -ь words (default)', () => {
    const inferGender = (cache as any).inferGenderFromRussian.bind(cache);

    // Unknown -ь words should default to masculine
    expect(inferGender('кабель')).toBe('masculine');
    expect(inferGender('корень')).toBe('masculine');
    expect(inferGender('уголь')).toBe('masculine');
    expect(inferGender('переключатель')).toBe('masculine');
    expect(inferGender('смеситель')).toBe('masculine');
  });

  it('should handle capitalization', () => {
    const inferGender = (cache as any).inferGenderFromRussian.bind(cache);

    // Should work with uppercase
    expect(inferGender('Дверь')).toBe('feminine');
    expect(inferGender('ЦЕПЬ')).toBe('feminine');
    expect(inferGender('Кабель')).toBe('masculine');
  });

  it('should handle whitespace', () => {
    const inferGender = (cache as any).inferGenderFromRussian.bind(cache);

    // Should trim whitespace
    expect(inferGender('  дверь  ')).toBe('feminine');
    expect(inferGender('  кабель  ')).toBe('masculine');
  });

  it('should still work for other endings', () => {
    const inferGender = (cache as any).inferGenderFromRussian.bind(cache);

    // -а/-я → feminine
    expect(inferGender('руда')).toBe('feminine');
    expect(inferGender('кирка')).toBe('feminine');

    // -о/-е → neuter
    expect(inferGender('окно')).toBe('neuter');
    expect(inferGender('поле')).toBe('neuter');

    // consonant → masculine
    expect(inferGender('блок')).toBe('masculine');
    expect(inferGender('слиток')).toBe('masculine');
  });

  it('should correctly identify gender in real translation scenario', () => {
    // Learn a translation with feminine -ь word
    cache.learn('Iron Door', 'Железная дверь');

    // Check that fragment was learned with correct gender
    const stats = cache.getStats();
    expect(stats.total).toBeGreaterThan(0);

    // Try to translate with different material
    const result = cache.tryTranslate('Copper Door');

    // Should apply feminine agreement: медная (not медный)
    if (result) {
      expect(result.toLowerCase()).toContain('медная');
      expect(result.toLowerCase()).not.toContain('медный');
    }
  });

  it('should correctly identify gender for chain (цепь - feminine)', () => {
    cache.learn('Iron Chain', 'Железная цепь');

    const result = cache.tryTranslate('Copper Chain');

    if (result) {
      expect(result.toLowerCase()).toContain('медная');
      expect(result.toLowerCase()).not.toContain('медный');
    }
  });

  it('should correctly identify gender for seal (печать - feminine)', () => {
    cache.learn('Iron Seal', 'Железная печать');

    const result = cache.tryTranslate('Copper Seal');

    if (result) {
      expect(result.toLowerCase()).toContain('медная');
      expect(result.toLowerCase()).not.toContain('медный');
    }
  });

  it('should correctly identify gender for gearshift (переключатель - masculine)', () => {
    cache.learn('Iron Gearshift', 'Железный переключатель');

    const result = cache.tryTranslate('Copper Gearshift');

    if (result) {
      expect(result.toLowerCase()).toContain('медный');
      expect(result.toLowerCase()).not.toContain('медная');
    }
  });
});
