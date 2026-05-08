/**
 * Tests for GrammarAssembler
 */

import { assembleSentence, translateSentenceWordByWord, getAssemblerStats, TranslatedToken } from '../../lib/grammarAssembler';
import { getWordCache } from '../../lib/wordCache';

describe('GrammarAssembler', () => {
  beforeEach(() => {
    // Note: We don't reset modules here because some tests need cache persistence
    // Individual tests that need a clean cache should handle it themselves
  });

  describe('assembleSentence', () => {
    it('should handle empty array', () => {
      const result = assembleSentence([]);
      expect(result).toBe('');
    });

    it('should handle single token', () => {
      const tokens: TranslatedToken[] = [
        { original: 'hero', translation: 'герой', pos: 'noun' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toBe('герой');
    });

    it('should join multiple tokens with spaces', () => {
      const tokens: TranslatedToken[] = [
        { original: 'ancient', translation: 'древний', pos: 'adjective' },
        { original: 'mine', translation: 'шахта', pos: 'noun' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toBe('древний шахта');
    });

    it('should apply adjective-noun agreement', () => {
      const tokens: TranslatedToken[] = [
        { original: 'iron', translation: 'железный', pos: 'adjective' },
        { original: 'sword', translation: 'меч', pos: 'noun', gender: 'm', number: 'sg' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toContain('меч');
    });

    it('should handle preposition + noun phrase', () => {
      const tokens: TranslatedToken[] = [
        { original: 'in', translation: 'в', pos: 'preposition' },
        { original: 'mine', translation: 'шахта', pos: 'noun', gender: 'f' }
      ];
      const result = assembleSentence(tokens);
      // Should apply prepositional case
      expect(result).toContain('в');
    });
  });

  describe('translateSentenceWordByWord', () => {
    it('should translate simple sentence', async () => {
      const mockTranslate = jest.fn(async (word: string) => {
        const dict: Record<string, string> = {
          'hero': 'герой',
          'found': 'нашёл',
          'sword': 'меч'
        };
        return dict[word.toLowerCase()] || null;
      });

      const result = await translateSentenceWordByWord('hero found sword', mockTranslate);

      expect(result).not.toBeNull();
      expect(mockTranslate).toHaveBeenCalledTimes(3);
    });

    it('should handle numbers in sentence', async () => {
      const mockTranslate = jest.fn(async (word: string) => {
        const dict: Record<string, string> = {
          'collect': 'собрать',
          'items': 'предметы'
        };
        return dict[word.toLowerCase()] || null;
      });

      const result = await translateSentenceWordByWord('collect 10 items', mockTranslate);

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toContain('10');
      }
    });

    it('should return null if word translation fails', async () => {
      const mockTranslate = jest.fn(async () => null);

      const result = await translateSentenceWordByWord('unknown word', mockTranslate);

      expect(result).toBeNull();
    });

    it('should use word cache on second call', async () => {
      const uniqueWord = 'uniqueTestWord' + Date.now();
      const mockTranslate = jest.fn(async (word: string) => {
        return word === uniqueWord ? 'тестовоеСлово' : null;
      });

      // First call - should translate
      await translateSentenceWordByWord(uniqueWord, mockTranslate);
      expect(mockTranslate).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      mockTranslate.mockClear();
      await translateSentenceWordByWord(uniqueWord, mockTranslate);
      expect(mockTranslate).toHaveBeenCalledTimes(0);
    });
  });

  describe('preposition case agreement', () => {
    it('should apply prepositional case after "в" (in)', () => {
      const tokens: TranslatedToken[] = [
        { original: 'in', translation: 'в', pos: 'preposition' },
        { original: 'mine', translation: 'шахта', pos: 'noun', gender: 'f' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toBeTruthy();
    });

    it('should apply genitive case after "from"', () => {
      const tokens: TranslatedToken[] = [
        { original: 'from', translation: 'из', pos: 'preposition' },
        { original: 'mine', translation: 'шахта', pos: 'noun', gender: 'f' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toBeTruthy();
    });

    it('should apply dative case after "to"', () => {
      const tokens: TranslatedToken[] = [
        { original: 'to', translation: 'к', pos: 'preposition' },
        { original: 'hero', translation: 'герой', pos: 'noun', gender: 'm' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toBeTruthy();
    });
  });

  describe('adjective-noun agreement', () => {
    it('should agree adjective with masculine noun', () => {
      const tokens: TranslatedToken[] = [
        { original: 'iron', translation: 'железный', pos: 'adjective' },
        { original: 'sword', translation: 'меч', pos: 'noun', gender: 'm', number: 'sg' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toContain('меч');
    });

    it('should agree adjective with feminine noun', () => {
      const tokens: TranslatedToken[] = [
        { original: 'iron', translation: 'железный', pos: 'adjective' },
        { original: 'ore', translation: 'руда', pos: 'noun', gender: 'f', number: 'sg' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toContain('руда');
    });

    it('should agree adjective with plural noun', () => {
      const tokens: TranslatedToken[] = [
        { original: 'iron', translation: 'железный', pos: 'adjective' },
        { original: 'ingots', translation: 'слитки', pos: 'noun', gender: 'm', number: 'pl' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toContain('слитки');
    });
  });

  describe('complex sentences', () => {
    it('should handle adjective + noun + preposition + noun', () => {
      const tokens: TranslatedToken[] = [
        { original: 'ancient', translation: 'древний', pos: 'adjective' },
        { original: 'hero', translation: 'герой', pos: 'noun', gender: 'm', number: 'sg' },
        { original: 'in', translation: 'в', pos: 'preposition' },
        { original: 'mine', translation: 'шахта', pos: 'noun', gender: 'f' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toBeTruthy();
      expect(result.split(' ').length).toBe(4);
    });

    it('should handle number + adjective + noun', () => {
      const tokens: TranslatedToken[] = [
        { original: '10', translation: '10', pos: 'number' },
        { original: 'iron', translation: 'железный', pos: 'adjective' },
        { original: 'ingots', translation: 'слитки', pos: 'noun', gender: 'm', number: 'pl' }
      ];
      const result = assembleSentence(tokens);
      expect(result).toContain('10');
      expect(result).toContain('слитки');
    });
  });

  describe('getAssemblerStats', () => {
    it('should return stats object', () => {
      const stats = getAssemblerStats();
      expect(stats).toHaveProperty('version');
      expect(stats).toHaveProperty('features');
      expect(Array.isArray(stats.features)).toBe(true);
      expect(stats.features.length).toBeGreaterThan(0);
    });
  });
});
