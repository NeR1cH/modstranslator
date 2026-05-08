/**
 * Tests for AgreementEngine
 */

import { AgreementEngine } from '../../lib/agreementEngine';
import { WordEntry } from '../../lib/wordLibrary';

describe('AgreementEngine', () => {
  let engine: AgreementEngine;

  // Test data
  const ironAdj: WordEntry = {
    pos: 'adjective',
    forms: {
      adj_m_sg: 'железный',
      adj_f_sg: 'железная',
      adj_n_sg: 'железное',
      adj_pl: 'железные'
    }
  };

  const ingotNoun: WordEntry = {
    pos: 'noun',
    gender: 'm',
    forms: {
      nom_sg: 'слиток',
      gen_sg: 'слитка',
      gen_pl: 'слитков',
      nom_pl: 'слитки'
    }
  };

  const oreNoun: WordEntry = {
    pos: 'noun',
    gender: 'f',
    forms: {
      nom_sg: 'руда',
      gen_sg: 'руды',
      gen_pl: 'руд',
      nom_pl: 'руды'
    }
  };

  beforeEach(() => {
    engine = new AgreementEngine();
  });

  describe('agreeAdjective', () => {
    it('should agree adjective with masculine noun in singular', () => {
      const result = engine.agreeAdjective(ironAdj, ingotNoun, false);
      expect(result).toBe('железный');
    });

    it('should agree adjective with masculine noun in plural', () => {
      const result = engine.agreeAdjective(ironAdj, ingotNoun, true);
      expect(result).toBe('железные');
    });

    it('should agree adjective with feminine noun in singular', () => {
      const result = engine.agreeAdjective(ironAdj, oreNoun, false);
      expect(result).toBe('железная');
    });

    it('should agree adjective with feminine noun in plural', () => {
      const result = engine.agreeAdjective(ironAdj, oreNoun, true);
      expect(result).toBe('железные');
    });

    it('should throw error if adjective is not adjective', () => {
      const notAdj: WordEntry = { pos: 'noun', gender: 'm', forms: {} };
      expect(() => engine.agreeAdjective(notAdj, ingotNoun, false))
        .toThrow('Expected adjective, got noun');
    });

    it('should throw error if noun is not noun', () => {
      const notNoun: WordEntry = { pos: 'verb', forms: {} };
      expect(() => engine.agreeAdjective(ironAdj, notNoun, false))
        .toThrow('Expected noun for gender agreement, got verb');
    });

    it('should throw error if form is missing', () => {
      const incompleteAdj: WordEntry = {
        pos: 'adjective',
        forms: { adj_m_sg: 'тест' }
      };
      expect(() => engine.agreeAdjective(incompleteAdj, ingotNoun, true))
        .toThrow('missing plural form');
    });
  });

  describe('declineNoun', () => {
    it('should use nom_sg for count=1', () => {
      const result = engine.declineNoun(ingotNoun, 1, false);
      expect(result).toBe('слиток');
    });

    it('should use gen_sg for count=2', () => {
      const result = engine.declineNoun(ingotNoun, 2, true);
      expect(result).toBe('слитка');
    });

    it('should use gen_sg for count=3', () => {
      const result = engine.declineNoun(ingotNoun, 3, true);
      expect(result).toBe('слитка');
    });

    it('should use gen_sg for count=4', () => {
      const result = engine.declineNoun(ingotNoun, 4, true);
      expect(result).toBe('слитка');
    });

    it('should use gen_pl for count=5', () => {
      const result = engine.declineNoun(ingotNoun, 5, true);
      expect(result).toBe('слитков');
    });

    it('should use gen_pl for count=10', () => {
      const result = engine.declineNoun(ingotNoun, 10, true);
      expect(result).toBe('слитков');
    });

    it('should use nom_pl for count=null and isPlural=true', () => {
      const result = engine.declineNoun(ingotNoun, null, true);
      expect(result).toBe('слитки');
    });

    it('should use nom_sg for count=null and isPlural=false', () => {
      const result = engine.declineNoun(ingotNoun, null, false);
      expect(result).toBe('слиток');
    });

    it('should throw error if noun is not noun', () => {
      const notNoun: WordEntry = { pos: 'adjective', forms: {} };
      expect(() => engine.declineNoun(notNoun, 1, false))
        .toThrow('Expected noun, got adjective');
    });

    it('should throw error if form is missing', () => {
      const incompleteNoun: WordEntry = {
        pos: 'noun',
        gender: 'm',
        forms: { nom_sg: 'тест' }
      };
      expect(() => engine.declineNoun(incompleteNoun, 5, true))
        .toThrow('missing form gen_pl');
    });
  });

  describe('required test cases from checklist', () => {
    it('iron(adj) + ingot(noun, m) + isPlural=false → "железный"', () => {
      const result = engine.agreeAdjective(ironAdj, ingotNoun, false);
      expect(result).toBe('железный');
    });

    it('iron(adj) + ingot(noun, m) + isPlural=true → "железные"', () => {
      const result = engine.agreeAdjective(ironAdj, ingotNoun, true);
      expect(result).toBe('железные');
    });

    it('declineNoun(ingot, 1, false) → "слиток"', () => {
      const result = engine.declineNoun(ingotNoun, 1, false);
      expect(result).toBe('слиток');
    });

    it('declineNoun(ingot, 5, true) → "слитков"', () => {
      const result = engine.declineNoun(ingotNoun, 5, true);
      expect(result).toBe('слитков');
    });

    it('declineNoun(ingot, 3, true) → "слитка"', () => {
      const result = engine.declineNoun(ingotNoun, 3, true);
      expect(result).toBe('слитка');
    });
  });
});
