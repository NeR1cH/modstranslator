/**
 * Tests for OpenRouter translator
 */

import { openrouterTranslator, OpenRouterTranslator } from '../../lib/openrouter';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenRouterTranslator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
  });

  describe('constructor', () => {
    it('should not throw error if API key is not set (lazy validation)', () => {
      delete process.env.OPENROUTER_API_KEY;
      expect(() => new OpenRouterTranslator()).not.toThrow();
    });

    it('should use default model if not specified', () => {
      delete process.env.OPENROUTER_MODEL;
      const translator = new OpenRouterTranslator();
      expect(translator.getModel()).toBe('google/gemma-4-31b-it:free');
    });

    it('should use custom model from env', () => {
      process.env.OPENROUTER_MODEL = 'deepseek/deepseek-chat';
      const translator = new OpenRouterTranslator();
      expect(translator.getModel()).toBe('deepseek/deepseek-chat');
    });
  });

  describe('translate', () => {
    it('should translate text successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Алмазный меч'
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const translator = new OpenRouterTranslator();
      const result = await translator.translate('Diamond Sword');

      expect(result).toBe('Алмазный меч');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should preserve formatting codes', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '§6Алмазный меч§r - Наносит %s урона'
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const translator = new OpenRouterTranslator();
      const result = await translator.translate('§6Diamond Sword§r - Deals %s damage', {
        preserveFormatting: true
      });

      expect(result).toBe('§6Алмазный меч§r - Наносит %s урона');
    });

    it('should use custom target language', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Diamantschwert' } }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const translator = new OpenRouterTranslator();
      await translator.translate('Diamond Sword', { targetLang: 'German' });

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain('German');
    });

    it('should throw error on API failure', async () => {
      // Mock all 3 retry attempts to return error
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal Server Error' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal Server Error' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal Server Error' } })
        });

      const translator = new OpenRouterTranslator();
      await expect(translator.translate('test')).rejects.toThrow('OpenRouter API error');
    });

    it('should handle 402 insufficient credits error', async () => {
      // Mock all 3 retry attempts to return error
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: async () => ({ error: { message: 'Insufficient credits' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: async () => ({ error: { message: 'Insufficient credits' } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: async () => ({ error: { message: 'Insufficient credits' } })
        });

      const translator = new OpenRouterTranslator();
      await expect(translator.translate('test')).rejects.toThrow('Insufficient credits');
    });
  });

  describe('translateBatch', () => {
    it('should translate multiple texts', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Алмазный меч\n###SPLIT###\nЖелезная кирка\n###SPLIT###\nЗолотой слиток'
            }
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const translator = new OpenRouterTranslator();
      const results = await translator.translateBatch([
        'Diamond Sword',
        'Iron Pickaxe',
        'Gold Ingot'
      ]);

      expect(results).toEqual(['Алмазный меч', 'Железная кирка', 'Золотой слиток']);
    });

    it('should return empty array for empty input', async () => {
      const translator = new OpenRouterTranslator();
      const results = await translator.translateBatch([]);
      expect(results).toEqual([]);
    });

    it('should fallback to individual translation on mismatch', async () => {
      const mockBatchResponse = {
        choices: [{ message: { content: 'Алмазный меч\n###SPLIT###\nЖелезная кирка' } }]
      };

      const mockIndividual1 = {
        choices: [{ message: { content: 'Алмазный меч' } }]
      };

      const mockIndividual2 = {
        choices: [{ message: { content: 'Железная кирка' } }]
      };

      const mockIndividual3 = {
        choices: [{ message: { content: 'Золотой слиток' } }]
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => mockBatchResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockIndividual1 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockIndividual2 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockIndividual3 });

      const translator = new OpenRouterTranslator();
      const results = await translator.translateBatch([
        'Diamond Sword',
        'Iron Pickaxe',
        'Gold Ingot'
      ]);

      expect(results).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledTimes(4); // 1 batch + 3 individual
    });
  });

  describe('getModel', () => {
    it('should return current model', () => {
      const translator = new OpenRouterTranslator();
      expect(translator.getModel()).toBe('google/gemma-4-31b-it:free');
    });
  });
});
