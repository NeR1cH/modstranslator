import JSZip from 'jszip';
import {
  extractLangFiles,
  translateLangFiles,
  repackJar,
  countJarStrings,
} from '@/lib/jarProcessor';
import * as deepl from '@/lib/deepl';
import * as langParsers from '@/lib/langParsers';

// Mock dependencies
jest.mock('@/lib/deepl');
jest.mock('@/lib/langParsers');

describe('jarProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractLangFiles', () => {
    it('should extract en_us.json from JAR', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.json', JSON.stringify({
        'item.sword': 'Diamond Sword',
        'item.axe': 'Iron Axe',
      }));
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('json');
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'item.sword', value: 'Diamond Sword' },
        { key: 'item.axe', value: 'Iron Axe' },
      ]);

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('assets/modid/lang/en_us.json');
      expect(result[0].format).toBe('json');
      expect(result[0].entries).toHaveLength(2);
    });

    it('should extract en_US.lang from old JAR', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_US.lang', 'item.sword=Diamond Sword\nitem.axe=Iron Axe');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('lang');
      (langParsers.parseDotLang as jest.Mock).mockReturnValue([
        { key: 'item.sword', value: 'Diamond Sword' },
        { key: 'item.axe', value: 'Iron Axe' },
      ]);

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('assets/modid/lang/en_US.lang');
      expect(result[0].format).toBe('lang');
      expect(result[0].entries).toHaveLength(2);
    });

    it('should return empty array for JAR with no lang files', async () => {
      const zip = new JSZip();
      zip.file('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0');
      zip.file('com/example/Main.class', 'binary data');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(false);

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple lang files', async () => {
      const zip = new JSZip();
      zip.file('assets/mod1/lang/en_us.json', '{"item.test": "Test"}');
      zip.file('assets/mod2/lang/en_us.json', '{"block.test": "Test Block"}');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('json');
      (langParsers.parseJsonLang as jest.Mock)
        .mockReturnValueOnce([{ key: 'item.test', value: 'Test' }])
        .mockReturnValueOnce([{ key: 'block.test', value: 'Test Block' }]);

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(2);
    });

    it('should skip malformed lang files', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.json', 'invalid json{');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('json');
      (langParsers.parseJsonLang as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(0);
    });

    it('should skip files with unknown format', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.txt', 'some text');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue(null);

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(0);
    });

    it('should skip directories', async () => {
      const zip = new JSZip();
      zip.folder('assets/modid/lang/');
      zip.file('assets/modid/lang/en_us.json', '{"test": "Test"}');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockImplementation((path) => {
        return path.endsWith('.json');
      });
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('json');
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'test', value: 'Test' }
      ]);

      const result = await extractLangFiles(jarBuffer);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('assets/modid/lang/en_us.json');
    });
  });

  describe('translateLangFiles', () => {
    it('should translate all entries', async () => {
      const langFiles = [
        {
          path: 'assets/modid/lang/en_us.json',
          format: 'json' as const,
          entries: [
            { key: 'item.sword', value: 'Diamond Sword' },
            { key: 'item.axe', value: 'Iron Axe' },
          ],
          rawContent: '{"item.sword": "Diamond Sword", "item.axe": "Iron Axe"}',
        },
      ];

      (deepl.translateTexts as jest.Mock).mockResolvedValue([
        'Алмазный меч',
        'Железный топор',
      ]);
      (langParsers.rebuildJsonLang as jest.Mock).mockReturnValue(
        '{"item.sword": "Алмазный меч", "item.axe": "Железный топор"}'
      );

      const result = await translateLangFiles(langFiles);

      expect(result.size).toBe(1);
      expect(result.get('assets/modid/lang/en_us.json')).toContain('Алмазный меч');
      expect(deepl.translateTexts).toHaveBeenCalledWith(['Diamond Sword', 'Iron Axe']);
    });

    it('should handle .lang format', async () => {
      const langFiles = [
        {
          path: 'assets/modid/lang/en_US.lang',
          format: 'lang' as const,
          entries: [
            { key: 'item.sword', value: 'Diamond Sword' },
          ],
          rawContent: 'item.sword=Diamond Sword',
        },
      ];

      (deepl.translateTexts as jest.Mock).mockResolvedValue(['Алмазный меч']);
      (langParsers.rebuildDotLang as jest.Mock).mockReturnValue('item.sword=Алмазный меч');

      const result = await translateLangFiles(langFiles);

      expect(result.size).toBe(1);
      expect(langParsers.rebuildDotLang).toHaveBeenCalled();
    });

    it('should skip files with no entries', async () => {
      const langFiles = [
        {
          path: 'assets/modid/lang/en_us.json',
          format: 'json' as const,
          entries: [],
          rawContent: '{}',
        },
      ];

      const result = await translateLangFiles(langFiles);

      expect(result.size).toBe(0);
      expect(deepl.translateTexts).not.toHaveBeenCalled();
    });

    it('should handle multiple files', async () => {
      const langFiles = [
        {
          path: 'assets/mod1/lang/en_us.json',
          format: 'json' as const,
          entries: [{ key: 'item.test', value: 'Test' }],
          rawContent: '{"item.test": "Test"}',
        },
        {
          path: 'assets/mod2/lang/en_us.json',
          format: 'json' as const,
          entries: [{ key: 'block.test', value: 'Test Block' }],
          rawContent: '{"block.test": "Test Block"}',
        },
      ];

      (deepl.translateTexts as jest.Mock)
        .mockResolvedValueOnce(['Тест'])
        .mockResolvedValueOnce(['Тестовый блок']);
      (langParsers.rebuildJsonLang as jest.Mock)
        .mockReturnValueOnce('{"item.test": "Тест"}')
        .mockReturnValueOnce('{"block.test": "Тестовый блок"}');

      const result = await translateLangFiles(langFiles);

      expect(result.size).toBe(2);
      expect(deepl.translateTexts).toHaveBeenCalledTimes(2);
    });

    it('should use original value if translation is missing', async () => {
      const langFiles = [
        {
          path: 'assets/modid/lang/en_us.json',
          format: 'json' as const,
          entries: [
            { key: 'item.sword', value: 'Diamond Sword' },
            { key: 'item.axe', value: 'Iron Axe' },
          ],
          rawContent: '{"item.sword": "Diamond Sword", "item.axe": "Iron Axe"}',
        },
      ];

      // Return only one translation
      (deepl.translateTexts as jest.Mock).mockResolvedValue(['Алмазный меч']);
      (langParsers.rebuildJsonLang as jest.Mock).mockImplementation((raw, map) => {
        // Verify that missing translation falls back to original
        expect(map.get('item.axe')).toBe('Iron Axe');
        return '{"item.sword": "Алмазный меч", "item.axe": "Iron Axe"}';
      });

      await translateLangFiles(langFiles);

      expect(langParsers.rebuildJsonLang).toHaveBeenCalled();
    });
  });

  describe('repackJar', () => {
    it('should add ru_ru.json file', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.json', '{"item.test": "Test"}');
      zip.file('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0');
      const originalJar = await zip.generateAsync({ type: 'nodebuffer' });

      const translations = new Map([
        ['assets/modid/lang/en_us.json', '{"item.test": "Тест"}'],
      ]);

      const result = await repackJar(originalJar, translations);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('assets/modid/lang/ru_ru.json')).not.toBeNull();
      expect(resultZip.file('assets/modid/lang/en_us.json')).not.toBeNull();
      expect(resultZip.file('META-INF/MANIFEST.MF')).not.toBeNull();
    });

    it('should add ru_ru.lang file for old format', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_US.lang', 'item.test=Test');
      const originalJar = await zip.generateAsync({ type: 'nodebuffer' });

      const translations = new Map([
        ['assets/modid/lang/en_US.lang', 'item.test=Тест'],
      ]);

      const result = await repackJar(originalJar, translations);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('assets/modid/lang/ru_ru.lang')).not.toBeNull();
    });

    it('should preserve all original files', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.json', '{"test": "Test"}');
      zip.file('assets/modid/textures/item.png', 'binary data');
      zip.file('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0');
      const originalJar = await zip.generateAsync({ type: 'nodebuffer' });

      const translations = new Map([
        ['assets/modid/lang/en_us.json', '{"test": "Тест"}'],
      ]);

      const result = await repackJar(originalJar, translations);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('assets/modid/textures/item.png')).not.toBeNull();
      expect(resultZip.file('META-INF/MANIFEST.MF')).not.toBeNull();
    });

    it('should handle multiple translations', async () => {
      const zip = new JSZip();
      zip.file('assets/mod1/lang/en_us.json', '{"test1": "Test1"}');
      zip.file('assets/mod2/lang/en_us.json', '{"test2": "Test2"}');
      const originalJar = await zip.generateAsync({ type: 'nodebuffer' });

      const translations = new Map([
        ['assets/mod1/lang/en_us.json', '{"test1": "Тест1"}'],
        ['assets/mod2/lang/en_us.json', '{"test2": "Тест2"}'],
      ]);

      const result = await repackJar(originalJar, translations);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('assets/mod1/lang/ru_ru.json')).not.toBeNull();
      expect(resultZip.file('assets/mod2/lang/ru_ru.json')).not.toBeNull();
    });

    it('should handle en.json format', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en.json', '{"test": "Test"}');
      const originalJar = await zip.generateAsync({ type: 'nodebuffer' });

      const translations = new Map([
        ['assets/modid/lang/en.json', '{"test": "Тест"}'],
      ]);

      const result = await repackJar(originalJar, translations);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('assets/modid/lang/ru_ru.json')).not.toBeNull();
    });

    it('should skip invalid paths', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.json', '{"test": "Test"}');
      const originalJar = await zip.generateAsync({ type: 'nodebuffer' });

      const translations = new Map([
        ['../../etc/passwd', 'malicious content'],
      ]);

      // Should not throw, just skip invalid path
      const result = await repackJar(originalJar, translations);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('etc/passwd')).toBeNull();
    });
  });

  describe('countJarStrings', () => {
    it('should count lang files and strings', async () => {
      const zip = new JSZip();
      zip.file('assets/modid/lang/en_us.json', '{"item.test": "Test"}');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('json');
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'item.test', value: 'Test' },
      ]);

      const result = await countJarStrings(jarBuffer);

      expect(result.langFilesCount).toBe(1);
      expect(result.stringsCount).toBe(1);
    });

    it('should count multiple files', async () => {
      const zip = new JSZip();
      zip.file('assets/mod1/lang/en_us.json', '{"test1": "Test1"}');
      zip.file('assets/mod2/lang/en_us.json', '{"test2": "Test2"}');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.detectLangFormat as jest.Mock).mockReturnValue('json');
      (langParsers.parseJsonLang as jest.Mock)
        .mockReturnValueOnce([{ key: 'test1', value: 'Test1' }])
        .mockReturnValueOnce([{ key: 'test2', value: 'Test2' }]);

      const result = await countJarStrings(jarBuffer);

      expect(result.langFilesCount).toBe(2);
      expect(result.stringsCount).toBe(2);
    });

    it('should return zero for JAR with no lang files', async () => {
      const zip = new JSZip();
      zip.file('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0');
      const jarBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(false);

      const result = await countJarStrings(jarBuffer);

      expect(result.langFilesCount).toBe(0);
      expect(result.stringsCount).toBe(0);
    });
  });
});
