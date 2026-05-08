/**
 * Tests for Universal Translator (hybrid system)
 */

import { translator } from '../../lib/translator';
import { translateTexts as deeplTranslate } from '../../lib/deepl';
import { openrouterTranslator } from '../../lib/openrouter';
import { getTranslationCache } from '../../lib/translationCache';

// Mock dependencies
jest.mock('../../lib/deepl');
jest.mock('../../lib/openrouter');
jest.mock('../../lib/translationCache');

describe('UniversalTranslator', () => {
  let mockCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRANSLATION_PROVIDER = 'hybrid';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.DEEPL_API_KEY = 'test-deepl-key:fx';

    // Mock cache to always return null (no cache hits)
    mockCache = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      getMany: jest.fn().mockReturnValue(new Map()),
      setMany: jest.fn()
    };
    (getTranslationCache as jest.Mock).mockReturnValue(mockCache);
  });

  afterEach(() => {
    delete process.env.TRANSLATION_PROVIDER;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPL_API_KEY;
    // Reset failed state
    translator.resetFailedState();
  });

  describe('hybrid mode', () => {
    it('should use OpenRouter first', async () => {
      (openrouterTranslator.translate as jest.Mock).mockResolvedValueOnce('Алмазный меч');

      const result = await translator.translate('Diamond Sword');

      expect(result).toBe('Алмазный меч');
      expect(openrouterTranslator.translate).toHaveBeenCalledWith('Diamond Sword', {
        targetLang: 'Russian',
        preserveFormatting: true
      });
      expect(deeplTranslate).not.toHaveBeenCalled();
    });

    it('should fallback to DeepL on OpenRouter error', async () => {
      (openrouterTranslator.translate as jest.Mock).mockRejectedValueOnce(
        new Error('OpenRouter API error')
      );
      (deeplTranslate as jest.Mock).mockResolvedValueOnce(['Алмазный меч']);

      const result = await translator.translate('Diamond Sword');

      expect(result).toBe('Алмазный меч');
      expect(openrouterTranslator.translate).toHaveBeenCalled();
      expect(deeplTranslate).toHaveBeenCalledWith(['Diamond Sword'], 'RU');
    });

    it('should use DeepL for subsequent calls after OpenRouter fails', async () => {
      // First call: OpenRouter fails
      (openrouterTranslator.translate as jest.Mock).mockRejectedValueOnce(
        new Error('OpenRouter API error')
      );
      (deeplTranslate as jest.Mock).mockResolvedValue(['Алмазный меч']);

      await translator.translate('Diamond Sword');

      // Second call: should skip OpenRouter
      await translator.translate('Iron Pickaxe');

      expect(openrouterTranslator.translate).toHaveBeenCalledTimes(1); // Only first call
      expect(deeplTranslate).toHaveBeenCalledTimes(2); // Both calls
    });

    it('should translate batch with OpenRouter', async () => {
      (openrouterTranslator.translateBatch as jest.Mock).mockResolvedValueOnce([
        'Алмазный меч',
        'Железная кирка'
      ]);

      const results = await translator.translateBatch(['Diamond Sword', 'Iron Pickaxe']);

      expect(results).toEqual(['Алмазный меч', 'Железная кирка']);
      expect(openrouterTranslator.translateBatch).toHaveBeenCalled();
      expect(deeplTranslate).not.toHaveBeenCalled();
    });

    it('should fallback batch translation to DeepL', async () => {
      (openrouterTranslator.translateBatch as jest.Mock).mockRejectedValueOnce(
        new Error('OpenRouter API error')
      );
      (deeplTranslate as jest.Mock).mockResolvedValueOnce(['Алмазный меч', 'Железная кирка']);

      const results = await translator.translateBatch(['Diamond Sword', 'Iron Pickaxe']);

      expect(results).toEqual(['Алмазный меч', 'Железная кирка']);
      expect(openrouterTranslator.translateBatch).toHaveBeenCalled();
      expect(deeplTranslate).toHaveBeenCalled();
    });
  });

  describe('fixed provider mode', () => {
    it('should use only OpenRouter when provider=openrouter', async () => {
      process.env.TRANSLATION_PROVIDER = 'openrouter';
      (openrouterTranslator.translate as jest.Mock).mockResolvedValueOnce('Алмазный меч');

      // Создаём новый экземпляр для этого теста
      const { UniversalTranslator } = require('../../lib/translator');
      const testTranslator = new UniversalTranslator();

      const result = await testTranslator.translate('Diamond Sword');

      expect(result).toBe('Алмазный меч');
      expect(openrouterTranslator.translate).toHaveBeenCalled();
      expect(deeplTranslate).not.toHaveBeenCalled();
    });

    it('should use only DeepL when provider=deepl', async () => {
      process.env.TRANSLATION_PROVIDER = 'deepl';
      (deeplTranslate as jest.Mock).mockResolvedValueOnce(['Алмазный меч']);

      // Создаём новый экземпляр для этого теста
      const { UniversalTranslator } = require('../../lib/translator');
      const testTranslator = new UniversalTranslator();

      const result = await testTranslator.translate('Diamond Sword');

      expect(result).toBe('Алмазный меч');
      expect(deeplTranslate).toHaveBeenCalled();
      expect(openrouterTranslator.translate).not.toHaveBeenCalled();
    });
  });

  describe('getProvider', () => {
    it('should return openrouter initially in hybrid mode', () => {
      expect(translator.getProvider()).toBe('openrouter');
    });

    it('should return deepl after OpenRouter fails', async () => {
      (openrouterTranslator.translate as jest.Mock).mockRejectedValueOnce(
        new Error('OpenRouter API error')
      );
      (deeplTranslate as jest.Mock).mockResolvedValueOnce(['Алмазный меч']);

      await translator.translate('Diamond Sword');

      expect(translator.getProvider()).toBe('deepl');
    });
  });

  describe('getProviderName', () => {
    it('should return OpenRouter model name', () => {
      (openrouterTranslator.getModel as jest.Mock).mockReturnValueOnce('google/gemma-4-31b-it:free');

      const name = translator.getProviderName();

      expect(name).toBe('OpenRouter (google/gemma-4-31b-it:free)');
    });

    it('should return DeepL after fallback', async () => {
      (openrouterTranslator.translate as jest.Mock).mockRejectedValueOnce(
        new Error('OpenRouter API error')
      );
      (deeplTranslate as jest.Mock).mockResolvedValueOnce(['Алмазный меч']);

      await translator.translate('Diamond Sword');

      expect(translator.getProviderName()).toBe('DeepL');
    });
  });

  describe('resetFailedState', () => {
    it('should reset to OpenRouter after manual reset', async () => {
      // Fail OpenRouter
      (openrouterTranslator.translate as jest.Mock).mockRejectedValueOnce(
        new Error('OpenRouter API error')
      );
      (deeplTranslate as jest.Mock).mockResolvedValue(['Алмазный меч']);

      await translator.translate('Diamond Sword');
      expect(translator.getProvider()).toBe('deepl');

      // Reset
      translator.resetFailedState();
      expect(translator.getProvider()).toBe('openrouter');

      // Next call should try OpenRouter again
      (openrouterTranslator.translate as jest.Mock).mockResolvedValueOnce('Железная кирка');
      await translator.translate('Iron Pickaxe');

      expect(openrouterTranslator.translate).toHaveBeenCalledTimes(2);
    });
  });

  describe('language code mapping', () => {
    it('should map RU to Russian for OpenRouter', async () => {
      (openrouterTranslator.translate as jest.Mock).mockResolvedValueOnce('Алмазный меч');

      await translator.translate('Diamond Sword', { targetLang: 'RU' });

      expect(openrouterTranslator.translate).toHaveBeenCalledWith('Diamond Sword', {
        targetLang: 'Russian',
        preserveFormatting: true
      });
    });

    it('should map EN to English for OpenRouter', async () => {
      (openrouterTranslator.translate as jest.Mock).mockResolvedValueOnce('Diamond Sword');

      await translator.translate('Алмазный меч', { targetLang: 'EN' });

      expect(openrouterTranslator.translate).toHaveBeenCalledWith('Алмазный меч', {
        targetLang: 'English',
        preserveFormatting: true
      });
    });
  });

  describe('no OpenRouter key', () => {
    it('should use DeepL if OpenRouter key is not set', async () => {
      delete process.env.OPENROUTER_API_KEY;
      (deeplTranslate as jest.Mock).mockResolvedValueOnce(['Алмазный меч']);

      // Создаём новый экземпляр для этого теста
      const { UniversalTranslator } = require('../../lib/translator');
      const testTranslator = new UniversalTranslator();

      const result = await testTranslator.translate('Diamond Sword');

      expect(result).toBe('Алмазный меч');
      expect(deeplTranslate).toHaveBeenCalled();
      expect(openrouterTranslator.translate).not.toHaveBeenCalled();
    });
  });
});
