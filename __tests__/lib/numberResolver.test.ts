/**
 * Tests for NumberResolver
 */

import { NumberResolver } from '../../lib/numberResolver';

describe('NumberResolver', () => {
  let resolver: NumberResolver;

  beforeEach(() => {
    resolver = new NumberResolver();
  });

  describe('resolve with explicit numbers', () => {
    it('should detect number 10 as plural', () => {
      const result = resolver.resolve(['10', 'ingots']);
      expect(result.count).toBe(10);
      expect(result.isPlural).toBe(true);
    });

    it('should detect number 1 as singular', () => {
      const result = resolver.resolve(['1', 'ingot']);
      expect(result.count).toBe(1);
      expect(result.isPlural).toBe(false);
    });

    it('should detect number 5 as plural', () => {
      const result = resolver.resolve(['5', 'ingots']);
      expect(result.count).toBe(5);
      expect(result.isPlural).toBe(true);
    });

    it('should prioritize number over plural ending', () => {
      const result = resolver.resolve(['1', 'ingots']);
      expect(result.count).toBe(1);
      expect(result.isPlural).toBe(false); // number takes priority
    });
  });

  describe('resolve with plural endings', () => {
    it('should detect plural ending -s', () => {
      const result = resolver.resolve(['ingots']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(true);
    });

    it('should detect singular without -s', () => {
      const result = resolver.resolve(['ingot']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });

    it('should handle multiple tokens with plural ending', () => {
      const result = resolver.resolve(['iron', 'ingots']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(true);
    });
  });

  describe('resolve with articles', () => {
    it('should detect article "a" as singular', () => {
      const result = resolver.resolve(['a', 'sword']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });

    it('should detect article "an" as singular', () => {
      const result = resolver.resolve(['an', 'ingot']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });

    it('should be case-insensitive for articles', () => {
      const result = resolver.resolve(['A', 'sword']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = resolver.resolve([]);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });

    it('should handle single token without plural', () => {
      const result = resolver.resolve(['sword']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });

    it('should not treat "glass" as plural', () => {
      const result = resolver.resolve(['glass']);
      expect(result.count).toBeNull();
      expect(result.isPlural).toBe(false);
    });

    it('should handle number 0 as plural', () => {
      const result = resolver.resolve(['0', 'ingots']);
      expect(result.count).toBe(0);
      expect(result.isPlural).toBe(true);
    });
  });

  describe('required test cases from checklist', () => {
    it('["10", "ingots"] → { count: 10, isPlural: true }', () => {
      const result = resolver.resolve(['10', 'ingots']);
      expect(result).toEqual({ count: 10, isPlural: true });
    });

    it('["1", "ingot"] → { count: 1, isPlural: false }', () => {
      const result = resolver.resolve(['1', 'ingot']);
      expect(result).toEqual({ count: 1, isPlural: false });
    });

    it('["ingots"] → { count: null, isPlural: true }', () => {
      const result = resolver.resolve(['ingots']);
      expect(result).toEqual({ count: null, isPlural: true });
    });

    it('["ingot"] → { count: null, isPlural: false }', () => {
      const result = resolver.resolve(['ingot']);
      expect(result).toEqual({ count: null, isPlural: false });
    });

    it('["a", "sword"] → { count: null, isPlural: false }', () => {
      const result = resolver.resolve(['a', 'sword']);
      expect(result).toEqual({ count: null, isPlural: false });
    });
  });
});
