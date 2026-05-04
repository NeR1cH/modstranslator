import JSZip from 'jszip';
import {
  analyzeModpack,
  translateModpack,
} from '@/lib/modpackProcessor';
import * as jarProcessor from '@/lib/jarProcessor';
import * as deepl from '@/lib/deepl';
import * as langParsers from '@/lib/langParsers';

// Mock dependencies
jest.mock('@/lib/jarProcessor');
jest.mock('@/lib/deepl');
jest.mock('@/lib/langParsers');

describe('modpackProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock langParsers
    (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(false);
    (langParsers.parseJsonLang as jest.Mock).mockReturnValue([]);
    (langParsers.parseDotLang as jest.Mock).mockReturnValue([]);
    (langParsers.parseSnbt as jest.Mock).mockReturnValue([]);
    (langParsers.rebuildJsonLang as jest.Mock).mockImplementation((content) => content);
    (langParsers.rebuildDotLang as jest.Mock).mockImplementation((content) => content);
    (langParsers.rebuildSnbt as jest.Mock).mockImplementation((content) => content);

    // Mock deepl
    (deepl.translateTexts as jest.Mock).mockResolvedValue([]);

    // Mock jarProcessor
    (jarProcessor.extractLangFiles as jest.Mock).mockResolvedValue([]);
    (jarProcessor.translateLangFiles as jest.Mock).mockResolvedValue(new Map());
    (jarProcessor.repackJar as jest.Mock).mockResolvedValue(Buffer.from('repacked'));
  });

  describe('analyzeModpack', () => {
    it('should analyze modpack with JAR files', async () => {
      const zip = new JSZip();
      zip.file('mods/test-mod.jar', 'jar content');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (jarProcessor.extractLangFiles as jest.Mock).mockResolvedValue([
        {
          path: 'assets/mod/lang/en_us.json',
          format: 'json',
          entries: [
            { key: 'item.test', value: 'Test Item' },
            { key: 'block.test', value: 'Test Block' },
          ],
          rawContent: '{}',
        },
      ]);

      const result = await analyzeModpack(zipBuffer);

      expect(result.totalFiles).toBe(1);
      expect(result.translatableFiles).toBe(1);
      expect(result.totalStrings).toBe(2);
    });

    it('should analyze modpack with lang files', async () => {
      const zip = new JSZip();
      zip.file('config/lang/en_us.json', '{"test": "Test"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'test', value: 'Test' },
      ]);

      const result = await analyzeModpack(zipBuffer);

      expect(result.totalFiles).toBe(1);
      expect(result.translatableFiles).toBe(1);
      expect(result.totalStrings).toBe(1);
    });

    it('should analyze modpack with SNBT files', async () => {
      const zip = new JSZip();
      zip.file('config/ftbquests/quests/lang/en_us.snbt', '{quest.TEST.title: "Test"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.parseSnbt as jest.Mock).mockReturnValue([
        { key: 'quest.TEST.title', value: 'Test' },
      ]);

      const result = await analyzeModpack(zipBuffer);

      expect(result.totalFiles).toBe(1);
      expect(result.translatableFiles).toBe(1);
      expect(result.totalStrings).toBe(1);
    });

    it('should skip Russian lang files', async () => {
      const zip = new JSZip();
      zip.file('config/lang/ru_ru.json', '{"test": "Тест"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await analyzeModpack(zipBuffer);

      expect(result.translatableFiles).toBe(0);
      expect(result.totalStrings).toBe(0);
    });

    it('should skip binary files', async () => {
      const zip = new JSZip();
      zip.file('textures/item.png', 'binary data');
      zip.file('sounds/music.ogg', 'binary data');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await analyzeModpack(zipBuffer);

      expect(result.translatableFiles).toBe(0);
    });

    it('should skip META-INF files', async () => {
      const zip = new JSZip();
      zip.file('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await analyzeModpack(zipBuffer);

      expect(result.translatableFiles).toBe(0);
    });

    it('should handle nested JSON files', async () => {
      const zip = new JSZip();
      zip.file('config/patchouli/books/guide.json', '{"text": "Guide"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.parseNestedJson as jest.Mock).mockReturnValue([
        { key: 'text', value: 'Guide' },
      ]);

      const result = await analyzeModpack(zipBuffer);

      expect(result.translatableFiles).toBe(1);
      expect(result.totalStrings).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      const zip = new JSZip();
      zip.file('config/lang/en_us.json', 'invalid json{');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await analyzeModpack(zipBuffer);

      expect(result.translatableFiles).toBe(0);
    });

    it('should count multiple files correctly', async () => {
      const zip = new JSZip();
      zip.file('mods/mod1.jar', 'jar1');
      zip.file('mods/mod2.jar', 'jar2');
      zip.file('config/lang/en_us.json', '{"test": "Test"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (jarProcessor.extractLangFiles as jest.Mock).mockResolvedValue([
        {
          path: 'assets/mod/lang/en_us.json',
          format: 'json',
          entries: [{ key: 'item', value: 'Item' }],
          rawContent: '{}',
        },
      ]);

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'test', value: 'Test' },
      ]);

      const result = await analyzeModpack(zipBuffer);

      expect(result.totalFiles).toBe(3);
      expect(result.translatableFiles).toBe(3);
      expect(result.totalStrings).toBe(3); // 1 + 1 + 1
    });
  });

  describe('translateModpack', () => {
    it('should translate modpack with JAR files', async () => {
      const zip = new JSZip();
      zip.file('mods/test-mod.jar', 'jar content');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (jarProcessor.extractLangFiles as jest.Mock).mockResolvedValue([
        {
          path: 'assets/mod/lang/en_us.json',
          format: 'json',
          entries: [{ key: 'item.test', value: 'Test Item' }],
          rawContent: '{}',
        },
      ]);

      (jarProcessor.translateLangFiles as jest.Mock).mockResolvedValue(
        new Map([['assets/mod/lang/en_us.json', '{"item.test": "Тестовый предмет"}']])
      );

      (jarProcessor.repackJar as jest.Mock).mockResolvedValue(Buffer.from('repacked jar'));

      const result = await translateModpack(zipBuffer);

      expect(jarProcessor.extractLangFiles).toHaveBeenCalled();
      expect(jarProcessor.translateLangFiles).toHaveBeenCalled();
      expect(jarProcessor.repackJar).toHaveBeenCalled();

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('mods/test-mod.jar')).not.toBeNull();
    });

    it('should translate lang files and create ru_ru versions', async () => {
      const zip = new JSZip();
      zip.file('config/lang/en_us.json', '{"test": "Test"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'test', value: 'Test' },
      ]);
      (deepl.translateTexts as jest.Mock).mockResolvedValue(['Тест']);
      (langParsers.rebuildJsonLang as jest.Mock).mockReturnValue('{"test": "Тест"}');

      const result = await translateModpack(zipBuffer);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('config/lang/en_us.json')).not.toBeNull();
      expect(resultZip.file('config/lang/ru_ru.json')).not.toBeNull();
    });

    it('should translate SNBT files', async () => {
      const zip = new JSZip();
      zip.file('config/ftbquests/quests/lang/en_us.snbt', '{quest.TEST.title: "Test"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.parseSnbt as jest.Mock).mockReturnValue([
        { key: 'quest.TEST.title', value: 'Test' },
      ]);
      (deepl.translateTexts as jest.Mock).mockResolvedValue(['Тест']);
      (langParsers.rebuildSnbt as jest.Mock).mockReturnValue('{quest.TEST.title: "Тест"}');

      const result = await translateModpack(zipBuffer);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('config/ftbquests/quests/lang/ru_ru.snbt')).not.toBeNull();
    });

    it('should call progress callback', async () => {
      const zip = new JSZip();
      zip.file('config/lang/en_us.json', '{"test": "Test"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([
        { key: 'test', value: 'Test' },
      ]);
      (deepl.translateTexts as jest.Mock).mockResolvedValue(['Тест']);

      const onProgress = jest.fn();

      await translateModpack(zipBuffer, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should skip files with no translatable content', async () => {
      const zip = new JSZip();
      zip.file('config/lang/en_us.json', '{}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockReturnValue([]);

      const result = await translateModpack(zipBuffer);

      expect(deepl.translateTexts).not.toHaveBeenCalled();

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('config/lang/ru_ru.json')).toBeNull();
    });

    it('should skip JAR files with no lang files', async () => {
      const zip = new JSZip();
      zip.file('mods/test-mod.jar', 'jar content');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (jarProcessor.extractLangFiles as jest.Mock).mockResolvedValue([]);

      await translateModpack(zipBuffer);

      expect(jarProcessor.translateLangFiles).not.toHaveBeenCalled();
      expect(jarProcessor.repackJar).not.toHaveBeenCalled();
    });

    it('should preserve original files', async () => {
      const zip = new JSZip();
      zip.file('README.txt', 'Readme content');
      zip.file('config/settings.cfg', 'setting=value');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await translateModpack(zipBuffer);

      const resultZip = await JSZip.loadAsync(result);
      expect(resultZip.file('README.txt')).not.toBeNull();
      expect(resultZip.file('config/settings.cfg')).not.toBeNull();
    });

    it('should handle nested JSON files', async () => {
      const zip = new JSZip();
      zip.file('config/patchouli/books/guide.json', '{"text": "Guide"}');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.parseNestedJson as jest.Mock).mockReturnValue([
        { key: 'text', value: 'Guide' },
      ]);
      (deepl.translateTexts as jest.Mock).mockResolvedValue(['Руководство']);
      (langParsers.rebuildNestedJson as jest.Mock).mockReturnValue('{"text": "Руководство"}');

      const result = await translateModpack(zipBuffer);

      const resultZip = await JSZip.loadAsync(result);
      const file = resultZip.file('config/patchouli/books/guide.json');
      expect(file).not.toBeNull();
    });

    it('should handle errors in file processing gracefully', async () => {
      const zip = new JSZip();
      zip.file('config/lang/en_us.json', 'invalid json{');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      (langParsers.isTargetLangFile as jest.Mock).mockReturnValue(true);
      (langParsers.parseJsonLang as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      // Should not throw
      const result = await translateModpack(zipBuffer);

      expect(result).toBeDefined();
    });

    it('should skip directories', async () => {
      const zip = new JSZip();
      zip.folder('mods');
      zip.folder('config');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await translateModpack(zipBuffer);

      expect(result).toBeDefined();
    });
  });
});
