/**
 * Tests for SentenceSplitter
 */

import { SentenceSplitter } from '../../lib/sentenceSplitter';

describe('SentenceSplitter', () => {
  let splitter: SentenceSplitter;

  beforeEach(() => {
    splitter = new SentenceSplitter();
  });

  describe('split', () => {
    it('should split simple sentence', () => {
      const tokens = splitter.split('the hero');

      expect(tokens).toHaveLength(2);
      expect(tokens[0].lemma).toBe('the');
      expect(tokens[0].pos).toBe('article');
      expect(tokens[1].lemma).toBe('hero');
      expect(tokens[1].pos).toBe('noun');
    });

    it('should handle punctuation', () => {
      const tokens = splitter.split('hero, warrior');

      expect(tokens).toHaveLength(2);
      expect(tokens[0].lemma).toBe('hero');
      expect(tokens[1].lemma).toBe('warrior');
    });

    it('should detect prepositions', () => {
      const tokens = splitter.split('inside the mine');

      expect(tokens[0].pos).toBe('preposition');
      expect(tokens[1].pos).toBe('article');
      expect(tokens[2].pos).toBe('noun');
    });

    it('should detect adjectives', () => {
      const tokens = splitter.split('ancient mine');

      expect(tokens[0].pos).toBe('adjective');
      expect(tokens[1].pos).toBe('noun');
    });

    it('should detect verbs', () => {
      const tokens = splitter.split('hero discovered portal');

      expect(tokens[0].pos).toBe('noun');
      expect(tokens[1].pos).toBe('verb');
      expect(tokens[2].pos).toBe('noun');
    });

    it('should mark content words', () => {
      const tokens = splitter.split('the ancient mine');

      expect(tokens[0].isContentWord).toBe(false); // article
      expect(tokens[1].isContentWord).toBe(true);  // adjective
      expect(tokens[2].isContentWord).toBe(true);  // noun
    });

    it('should handle complex sentence', () => {
      const tokens = splitter.split('Inside the ancient mine, the hero discovered a portal');

      expect(tokens.length).toBeGreaterThan(5);
      expect(tokens.some(t => t.pos === 'preposition')).toBe(true);
      expect(tokens.some(t => t.pos === 'adjective')).toBe(true);
      expect(tokens.some(t => t.pos === 'noun')).toBe(true);
      expect(tokens.some(t => t.pos === 'verb')).toBe(true);
    });
  });

  describe('getContentWords', () => {
    it('should extract only content words', () => {
      const tokens = splitter.split('the ancient mine');
      const content = splitter.getContentWords(tokens);

      expect(content).toHaveLength(2);
      expect(content[0].lemma).toBe('ancient');
      expect(content[1].lemma).toBe('mine');
    });

    it('should filter out articles and prepositions', () => {
      const tokens = splitter.split('inside the ancient mine');
      const content = splitter.getContentWords(tokens);

      expect(content).toHaveLength(2);
      expect(content[0].lemma).toBe('ancient');
      expect(content[1].lemma).toBe('mine');
    });

    it('should include verbs', () => {
      const tokens = splitter.split('hero discovered portal');
      const content = splitter.getContentWords(tokens);

      expect(content).toHaveLength(3);
      expect(content.map(t => t.lemma)).toEqual(['hero', 'discovered', 'portal']);
    });
  });

  describe('getByPOS', () => {
    it('should get all nouns', () => {
      const tokens = splitter.split('the hero found a portal');
      const nouns = splitter.getByPOS(tokens, 'noun');

      expect(nouns).toHaveLength(2);
      expect(nouns.map(t => t.lemma)).toEqual(['hero', 'portal']);
    });

    it('should get all verbs', () => {
      const tokens = splitter.split('hero discovered and collected items');
      const verbs = splitter.getByPOS(tokens, 'verb');

      expect(verbs.length).toBeGreaterThan(0);
      expect(verbs.some(t => t.lemma === 'discovered')).toBe(true);
    });

    it('should get all adjectives', () => {
      const tokens = splitter.split('ancient powerful magical sword');
      const adjectives = splitter.getByPOS(tokens, 'adjective');

      expect(adjectives.length).toBeGreaterThan(0);
      expect(adjectives.some(t => t.lemma === 'ancient')).toBe(true);
    });
  });

  describe('analyzeStructure', () => {
    it('should detect simple sentence', () => {
      const tokens = splitter.split('ancient mine');
      const structure = splitter.analyzeStructure(tokens);

      expect(structure.hasSubject).toBe(true);
      expect(structure.hasVerb).toBe(false);
      expect(structure.complexity).toBe('simple');
    });

    it('should detect sentence with verb', () => {
      const tokens = splitter.split('hero discovered portal');
      const structure = splitter.analyzeStructure(tokens);

      expect(structure.hasSubject).toBe(true);
      expect(structure.hasVerb).toBe(true);
      expect(structure.hasObject).toBe(true);
    });

    it('should detect compound sentence', () => {
      const tokens = splitter.split('hero found sword and collected items');
      const structure = splitter.analyzeStructure(tokens);

      expect(structure.complexity).toBe('compound');
    });

    it('should detect complex sentence', () => {
      const tokens = splitter.split('Inside the ancient mine the hero discovered a mysterious portal');
      const structure = splitter.analyzeStructure(tokens);

      expect(structure.complexity).toBe('complex');
    });
  });

  describe('real-world examples', () => {
    it('should handle "Inside the ancient mine"', () => {
      const tokens = splitter.split('Inside the ancient mine');

      expect(tokens).toHaveLength(4);
      expect(tokens[0].pos).toBe('preposition'); // inside
      expect(tokens[1].pos).toBe('article');     // the
      expect(tokens[2].pos).toBe('adjective');   // ancient
      expect(tokens[3].pos).toBe('noun');        // mine

      const content = splitter.getContentWords(tokens);
      expect(content).toHaveLength(2);
      expect(content.map(t => t.lemma)).toEqual(['ancient', 'mine']);
    });

    it('should handle "the hero discovered a portal"', () => {
      const tokens = splitter.split('the hero discovered a portal');

      const content = splitter.getContentWords(tokens);
      expect(content.length).toBeGreaterThanOrEqual(3);
      expect(content.some(t => t.lemma === 'hero')).toBe(true);
      expect(content.some(t => t.lemma === 'discovered')).toBe(true);
      expect(content.some(t => t.lemma === 'portal')).toBe(true);
    });

    it('should handle "Collect 10 iron ingots from the mine"', () => {
      const tokens = splitter.split('Collect 10 iron ingots from the mine');

      const content = splitter.getContentWords(tokens);
      expect(content.length).toBeGreaterThan(0);
      expect(content.some(t => t.lemma === 'collect')).toBe(true);
      expect(content.some(t => t.lemma === 'iron')).toBe(true);
      expect(content.some(t => t.lemma === 'ingots')).toBe(true);
      expect(content.some(t => t.lemma === 'mine')).toBe(true);
    });

    it('should handle numbers in sentence', () => {
      const tokens = splitter.split('Collect 10 items');

      // "10" should be filtered out (not a word)
      expect(tokens.every(t => t.lemma !== '10')).toBe(true);
      expect(tokens.some(t => t.lemma === 'collect')).toBe(true);
      expect(tokens.some(t => t.lemma === 'items')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const tokens = splitter.split('');
      expect(tokens).toHaveLength(0);
    });

    it('should handle single word', () => {
      const tokens = splitter.split('hero');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].lemma).toBe('hero');
    });

    it('should handle multiple spaces', () => {
      const tokens = splitter.split('hero    warrior');
      expect(tokens).toHaveLength(2);
    });

    it('should handle special characters', () => {
      const tokens = splitter.split('hero\'s sword');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].lemma).toBe('heros');
      expect(tokens[1].lemma).toBe('sword');
    });
  });
});
