/**
 * Tests for WordLibrary
 */

import { WordLibrary, WordEntry } from '../../lib/wordLibrary';

describe('WordLibrary', () => {
  let library: WordLibrary;

  beforeEach(() => {
    library = new WordLibrary();
  });

  describe('getWord', () => {
    it('should return word entry for known word', () => {
      const entry = library.getWord('iron');
      expect(entry).not.toBeNull();
      expect(entry?.pos).toBe('adjective');
      expect(entry?.forms.adj_m_sg).toBe('железный');
    });

    it('should return null for unknown word', () => {
      const entry = library.getWord('xyz');
      expect(entry).toBeNull();
    });

    it('should be case-insensitive', () => {
      const entry1 = library.getWord('iron');
      const entry2 = library.getWord('IRON');
      const entry3 = library.getWord('Iron');

      expect(entry1).not.toBeNull();
      expect(entry2).not.toBeNull();
      expect(entry3).not.toBeNull();
      expect(entry1?.forms.adj_m_sg).toBe(entry2?.forms.adj_m_sg);
    });
  });

  describe('hasWord', () => {
    it('should return true for known word', () => {
      expect(library.hasWord('iron')).toBe(true);
      expect(library.hasWord('ingot')).toBe(true);
    });

    it('should return false for unknown word', () => {
      expect(library.hasWord('xyz')).toBe(false);
    });
  });

  describe('addWord', () => {
    it('should add new word', () => {
      const entry: WordEntry = {
        pos: 'noun',
        gender: 'm',
        forms: {
          nom_sg: 'тест'
        }
      };

      library.addWord('test', entry);

      const retrieved = library.getWord('test');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.pos).toBe('noun');
      expect(retrieved?.forms.nom_sg).toBe('тест');
    });

    it('should update existing word', () => {
      const newEntry: WordEntry = {
        pos: 'adjective',
        forms: {
          adj_m_sg: 'новый железный'
        }
      };

      library.addWord('iron', newEntry);

      const retrieved = library.getWord('iron');
      expect(retrieved?.forms.adj_m_sg).toBe('новый железный');
    });
  });

  describe('default words', () => {
    it('should have all required nouns', () => {
      expect(library.hasWord('ingot')).toBe(true);
      expect(library.hasWord('ingots')).toBe(true);
      expect(library.hasWord('sword')).toBe(true);
      expect(library.hasWord('pickaxe')).toBe(true);
      expect(library.hasWord('ore')).toBe(true);
    });

    it('should have all required adjectives', () => {
      expect(library.hasWord('iron')).toBe(true);
      expect(library.hasWord('gold')).toBe(true);
      expect(library.hasWord('diamond')).toBe(true);
      expect(library.hasWord('copper')).toBe(true);
      expect(library.hasWord('raw')).toBe(true);
    });

    it('should have all required verbs', () => {
      expect(library.hasWord('collect')).toBe(true);
      expect(library.hasWord('craft')).toBe(true);
      expect(library.hasWord('bring')).toBe(true);
    });

    it('should have correct forms for ingot', () => {
      const ingot = library.getWord('ingot');
      expect(ingot?.pos).toBe('noun');
      expect(ingot?.gender).toBe('m');
      expect(ingot?.forms.nom_sg).toBe('слиток');
      expect(ingot?.forms.gen_sg).toBe('слитка');
      expect(ingot?.forms.gen_pl).toBe('слитков');
      expect(ingot?.forms.nom_pl).toBe('слитки');
    });

    it('should have correct forms for iron', () => {
      const iron = library.getWord('iron');
      expect(iron?.pos).toBe('adjective');
      expect(iron?.forms.adj_m_sg).toBe('железный');
      expect(iron?.forms.adj_f_sg).toBe('железная');
      expect(iron?.forms.adj_n_sg).toBe('железное');
      expect(iron?.forms.adj_pl).toBe('железные');
    });
  });
});
