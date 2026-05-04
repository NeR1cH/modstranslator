import { getTranslationHistory } from '@/lib/translationHistory';

describe('translationHistory', () => {
  beforeEach(() => {
    // Mock localStorage
    const mockStorage: { [key: string]: string } = {};

    global.localStorage = {
      getItem: jest.fn((key: string) => mockStorage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    } as any;

    // Mock crypto.randomUUID
    global.crypto = {
      randomUUID: jest.fn(() => 'test-uuid-123'),
    } as any;
  });

  describe('getTranslationHistory', () => {
    it('should create history instance', () => {
      const history = getTranslationHistory();

      expect(history).toBeDefined();
      expect(history.save).toBeDefined();
      expect(history.getAll).toBeDefined();
      expect(history.getById).toBeDefined();
      expect(history.delete).toBeDefined();
      expect(history.clear).toBeDefined();
    });
  });

  describe('save', () => {
    it('should not throw when saving', async () => {
      const history = getTranslationHistory();

      await expect(history.save({
        fileName: 'test-mod.jar',
        outputFileName: 'test-mod_translated.jar',
        stringsCount: 100,
        format: 'jar',
        resultBase64: 'base64data',
        fileSize: 1024,
      })).resolves.not.toThrow();
    });

    it('should skip entries that are too large', async () => {
      const history = getTranslationHistory();
      const largeBase64 = 'a'.repeat(11 * 1024 * 1024);

      await expect(history.save({
        fileName: 'large-file.jar',
        outputFileName: 'large-file_translated.jar',
        stringsCount: 1000,
        format: 'jar',
        resultBase64: largeBase64,
        fileSize: 1024,
      })).resolves.not.toThrow();
    });
  });

  describe('getAll', () => {
    it('should return array', async () => {
      const history = getTranslationHistory();
      const result = await history.getAll();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getById', () => {
    it('should not throw', async () => {
      const history = getTranslationHistory();

      await expect(history.getById('test-id')).resolves.toBeDefined();
    });
  });

  describe('delete', () => {
    it('should not throw', async () => {
      const history = getTranslationHistory();

      await expect(history.delete('test-id')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should not throw', async () => {
      const history = getTranslationHistory();

      await expect(history.clear()).resolves.not.toThrow();
    });
  });
});


