import { translateTexts } from '@/lib/deepl';
import * as rateLimiter from '@/lib/rateLimiter';
import * as translationCache from '@/lib/translationCache';
import * as fragmentCache from '@/lib/fragmentCache';
import * as security from '@/lib/security';

// Mock dependencies
jest.mock('@/lib/rateLimiter');
jest.mock('@/lib/translationCache');
jest.mock('@/lib/fragmentCache');
jest.mock('@/lib/security');

describe('deepl', () => {
  const mockApiKey = 'test-api-key:fx';
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, DEEPL_API_KEY: mockApiKey };

    // Mock rate limiter
    (rateLimiter.getRateLimiter as jest.Mock).mockReturnValue({
      checkLimit: jest.fn().mockResolvedValue(undefined),
      recordUsage: jest.fn(),
      getCurrentKey: jest.fn().mockReturnValue(mockApiKey),
    });

    // Mock translation cache
    (translationCache.getTranslationCache as jest.Mock).mockReturnValue({
      getMany: jest.fn().mockReturnValue(new Map()),
      setMany: jest.fn(),
    });

    // Mock fragment cache
    (fragmentCache.getFragmentCache as jest.Mock).mockReturnValue({
      tryTranslate: jest.fn().mockReturnValue(null),
      learn: jest.fn(),
    });

    // Mock fetch
    (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        translations: [
          { text: 'Алмазный меч' },
          { text: 'Железный топор' },
        ],
      }),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('translateTexts', () => {
    it('should translate texts successfully', async () => {
      const texts = ['Diamond Sword', 'Iron Axe'];

      const result = await translateTexts(texts);

      expect(result).toEqual(['Алмазный меч', 'Железный топор']);
      expect(security.fetchWithTimeout).toHaveBeenCalledWith(
        'https://api-free.deepl.com/v2/translate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `DeepL-Auth-Key ${mockApiKey}`,
          }),
        }),
        30000
      );
    });

    it('should return empty array for empty input', async () => {
      const result = await translateTexts([]);

      expect(result).toEqual([]);
      expect(security.fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('should throw error if API key is missing', async () => {
      delete process.env.DEEPL_API_KEY;

      // Mock getRateLimiter to throw error
      (rateLimiter.getRateLimiter as jest.Mock).mockImplementation(() => {
        throw new Error('DEEPL_API_KEY или DEEPL_API_KEYS не задан в .env файле');
      });

      await expect(translateTexts(['Test'])).rejects.toThrow(
        'DEEPL_API_KEY'
      );
    });

    it('should use cached translations', async () => {
      const texts = ['Diamond Sword', 'Iron Axe'];
      const cachedMap = new Map([
        ['Diamond Sword', 'Алмазный меч'],
        ['Iron Axe', 'Железный топор'],
      ]);

      (translationCache.getTranslationCache as jest.Mock).mockReturnValue({
        getMany: jest.fn().mockReturnValue(cachedMap),
        setMany: jest.fn(),
      });

      const result = await translateTexts(texts);

      expect(result).toEqual(['Алмазный меч', 'Железный топор']);
      expect(security.fetchWithTimeout).not.toHaveBeenCalled();
    });

    it('should use fragment cache for partial matches', async () => {
      const texts = ['Diamond Sword', 'Iron Axe'];

      (fragmentCache.getFragmentCache as jest.Mock).mockReturnValue({
        tryTranslate: jest.fn()
          .mockReturnValueOnce('Алмазный меч') // First text from fragments
          .mockReturnValueOnce(null), // Second text not in fragments
        learn: jest.fn(),
      });

      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          translations: [{ text: 'Железный топор' }],
        }),
      });

      const result = await translateTexts(texts);

      expect(result).toEqual(['Алмазный меч', 'Железный топор']);
    });

    it('should check rate limit before translation', async () => {
      const texts = ['Diamond Sword'];
      const mockCheckLimit = jest.fn().mockResolvedValue(undefined);

      (rateLimiter.getRateLimiter as jest.Mock).mockReturnValue({
        checkLimit: mockCheckLimit,
        recordUsage: jest.fn(),
        getCurrentKey: jest.fn().mockReturnValue(mockApiKey),
      });

      await translateTexts(texts);

      expect(mockCheckLimit).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should record usage after successful translation', async () => {
      const texts = ['Diamond Sword'];
      const mockRecordUsage = jest.fn();

      (rateLimiter.getRateLimiter as jest.Mock).mockReturnValue({
        checkLimit: jest.fn().mockResolvedValue(undefined),
        recordUsage: mockRecordUsage,
        getCurrentKey: jest.fn().mockReturnValue(mockApiKey),
      });

      await translateTexts(texts);

      expect(mockRecordUsage).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should cache new translations', async () => {
      const texts = ['Diamond Sword'];
      const mockSetMany = jest.fn();

      (translationCache.getTranslationCache as jest.Mock).mockReturnValue({
        getMany: jest.fn().mockReturnValue(new Map()),
        setMany: mockSetMany,
      });

      await translateTexts(texts);

      expect(mockSetMany).toHaveBeenCalledWith([
        { original: 'Diamond Sword', translated: 'Алмазный меч' },
      ]);
    });

    it('should learn fragments from new translations', async () => {
      const texts = ['Diamond Sword'];
      const mockLearn = jest.fn();

      (fragmentCache.getFragmentCache as jest.Mock).mockReturnValue({
        tryTranslate: jest.fn().mockReturnValue(null),
        learn: mockLearn,
      });

      await translateTexts(texts);

      expect(mockLearn).toHaveBeenCalledWith('Diamond Sword', 'Алмазный меч');
    });

    it('should handle batching for large inputs', async () => {
      const texts = Array(100).fill('Test');

      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          translations: Array(50).fill({ text: 'Тест' }),
        }),
      });

      await translateTexts(texts);

      // Should make 2 API calls (batch size is 50)
      expect(security.fetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should use Pro API URL for Pro keys', async () => {
      const proKey = 'test-pro-key'; // No :fx suffix

      (rateLimiter.getRateLimiter as jest.Mock).mockReturnValue({
        checkLimit: jest.fn().mockResolvedValue(undefined),
        recordUsage: jest.fn(),
        getCurrentKey: jest.fn().mockReturnValue(proKey),
      });

      await translateTexts(['Test']);

      expect(security.fetchWithTimeout).toHaveBeenCalledWith(
        'https://api.deepl.com/v2/translate',
        expect.any(Object),
        30000
      );
    });

    it('should use Free API URL for Free keys', async () => {
      process.env.DEEPL_API_KEY = 'test-free-key:fx';

      await translateTexts(['Test']);

      expect(security.fetchWithTimeout).toHaveBeenCalledWith(
        'https://api-free.deepl.com/v2/translate',
        expect.any(Object),
        30000
      );
    });

    it('should retry on 429 rate limit', async () => {
      (security.fetchWithTimeout as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            translations: [{ text: 'Тест' }],
          }),
        });

      const result = await translateTexts(['Test']);

      expect(result).toEqual(['Тест']);
      expect(security.fetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries on 429', async () => {
      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
      });

      await expect(translateTexts(['Test'])).rejects.toThrow(
        'Превышен лимит запросов DeepL API'
      );

      expect(security.fetchWithTimeout).toHaveBeenCalledTimes(3);
    });

    it('should retry on 500 server error', async () => {
      (security.fetchWithTimeout as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            translations: [{ text: 'Тест' }],
          }),
        });

      const result = await translateTexts(['Test']);

      expect(result).toEqual(['Тест']);
      expect(security.fetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries on 500', async () => {
      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(translateTexts(['Test'])).rejects.toThrow(
        'Сервер DeepL временно недоступен'
      );

      expect(security.fetchWithTimeout).toHaveBeenCalledTimes(3);
    });

    it('should throw error on 403 authentication failure', async () => {
      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(translateTexts(['Test'])).rejects.toThrow(
        'Неверный API ключ DeepL'
      );
    });

    it('should throw error on 456 quota exceeded', async () => {
      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 456,
      });

      await expect(translateTexts(['Test'])).rejects.toThrow(
        'Исчерпан лимит символов DeepL API'
      );
    });

    it('should throw error on other API errors', async () => {
      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad request'),
      });

      await expect(translateTexts(['Test'])).rejects.toThrow(
        'Ошибка DeepL API (400)'
      );
    });

    it('should preserve order when mixing cached and new translations', async () => {
      const texts = ['Text1', 'Text2', 'Text3'];
      const cachedMap = new Map([['Text2', 'Текст2']]);

      (translationCache.getTranslationCache as jest.Mock).mockReturnValue({
        getMany: jest.fn().mockReturnValue(cachedMap),
        setMany: jest.fn(),
      });

      (security.fetchWithTimeout as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          translations: [
            { text: 'Текст1' },
            { text: 'Текст3' },
          ],
        }),
      });

      const result = await translateTexts(texts);

      expect(result).toEqual(['Текст1', 'Текст2', 'Текст3']);
    });

    it('should include tag_handling parameters for Minecraft format codes', async () => {
      await translateTexts(['Test']);

      const callArgs = (security.fetchWithTimeout as jest.Mock).mock.calls[0];
      const body = callArgs[1].body;

      expect(body).toContain('tag_handling=xml');
      expect(body).toContain('ignore_tags=keep');
    });

    it('should set target_lang to RU and source_lang to EN', async () => {
      await translateTexts(['Test']);

      const callArgs = (security.fetchWithTimeout as jest.Mock).mock.calls[0];
      const body = callArgs[1].body;

      expect(body).toContain('target_lang=RU');
      expect(body).toContain('source_lang=EN');
    });
  });
});
