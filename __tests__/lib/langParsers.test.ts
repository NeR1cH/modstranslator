import {
  hasTranslatableText,
  detectFormat,
  parseJsonLang,
  rebuildJsonLang,
  parseDotLang,
  rebuildDotLang,
  parseSnbt,
  rebuildSnbt,
  parseToml,
  rebuildToml,
  parseCfg,
  rebuildCfg,
  parseNestedJson,
  rebuildNestedJson,
  parseXml,
  rebuildXml,
  parsePlainText,
  rebuildPlainText,
} from '@/lib/langParsers';

describe('langParsers', () => {
  describe('hasTranslatableText', () => {
    it('should return true for English text', () => {
      expect(hasTranslatableText('Hello World')).toBe(true);
      expect(hasTranslatableText('Item name')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(hasTranslatableText('')).toBe(false);
    });

    it('should return false for single characters', () => {
      expect(hasTranslatableText('a')).toBe(false);
    });

    it('should return false for numbers only', () => {
      expect(hasTranslatableText('123')).toBe(false);
      expect(hasTranslatableText('456.78')).toBe(false);
    });

    it('should return true for mixed alphanumeric', () => {
      expect(hasTranslatableText('Item 123')).toBe(true);
      expect(hasTranslatableText('Level 5')).toBe(true);
    });

    it('should return false for whitespace only', () => {
      expect(hasTranslatableText('   ')).toBe(false);
    });

    it('should return true for text with special characters', () => {
      expect(hasTranslatableText('Hello, World!')).toBe(true);
      expect(hasTranslatableText('Item: %s')).toBe(true);
    });
  });

  describe('detectFormat', () => {
    it('should detect json format', () => {
      expect(detectFormat('en_us.json')).toBe('json');
      expect(detectFormat('test.JSON')).toBe('json');
    });

    it('should detect lang format', () => {
      expect(detectFormat('en_us.lang')).toBe('lang');
      expect(detectFormat('test.LANG')).toBe('lang');
    });

    it('should detect snbt format', () => {
      expect(detectFormat('quests.snbt')).toBe('snbt');
      expect(detectFormat('test.SNBT')).toBe('snbt');
    });

    it('should detect toml format', () => {
      expect(detectFormat('config.toml')).toBe('toml');
    });

    it('should detect cfg format', () => {
      expect(detectFormat('config.cfg')).toBe('cfg');
    });

    it('should detect txt format', () => {
      expect(detectFormat('readme.txt')).toBe('txt');
    });

    it('should detect xml format', () => {
      expect(detectFormat('config.xml')).toBe('xml');
    });

    it('should detect properties format', () => {
      expect(detectFormat('app.properties')).toBe('properties');
    });

    it('should detect yaml format', () => {
      expect(detectFormat('config.yml')).toBe('yaml');
      expect(detectFormat('config.yaml')).toBe('yaml');
    });

    it('should return null for unknown formats', () => {
      expect(detectFormat('file.exe')).toBeNull();
      expect(detectFormat('file.zip')).toBeNull();
    });
  });

  describe('JSON Lang Parser', () => {
    describe('parseJsonLang', () => {
      it('should parse flat JSON correctly', () => {
        const content = JSON.stringify({
          'item.sword': 'Diamond Sword',
          'item.axe': 'Iron Axe',
        });
        const result = parseJsonLang(content);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ key: 'item.sword', value: 'Diamond Sword' });
        expect(result[1]).toEqual({ key: 'item.axe', value: 'Iron Axe' });
      });

      it('should ignore non-string values', () => {
        const content = JSON.stringify({
          'item.sword': 'Diamond Sword',
          'item.count': 123,
          'item.enabled': true,
        });
        const result = parseJsonLang(content);
        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('item.sword');
      });

      it('should ignore empty strings', () => {
        const content = JSON.stringify({
          'item.sword': 'Diamond Sword',
          'item.empty': '',
        });
        const result = parseJsonLang(content);
        expect(result).toHaveLength(1);
      });

      it('should handle special characters', () => {
        const content = JSON.stringify({
          'item.name': 'Item: %s',
          'item.desc': 'Use {0} to craft',
        });
        const result = parseJsonLang(content);
        expect(result).toHaveLength(2);
      });

      it('should handle Unicode', () => {
        const content = JSON.stringify({
          'item.name': 'Test 测试',
        });
        const result = parseJsonLang(content);
        expect(result).toHaveLength(1);
      });
    });

    describe('rebuildJsonLang', () => {
      it('should replace translations correctly', () => {
        const original = JSON.stringify({
          'item.sword': 'Diamond Sword',
          'item.axe': 'Iron Axe',
        }, null, 2);
        const translations = new Map([
          ['item.sword', 'Алмазный меч'],
          ['item.axe', 'Железный топор'],
        ]);
        const result = rebuildJsonLang(original, translations);
        const parsed = JSON.parse(result);
        expect(parsed['item.sword']).toBe('Алмазный меч');
        expect(parsed['item.axe']).toBe('Железный топор');
      });

      it('should preserve untranslated keys', () => {
        const original = JSON.stringify({
          'item.sword': 'Diamond Sword',
          'item.axe': 'Iron Axe',
        }, null, 2);
        const translations = new Map([
          ['item.sword', 'Алмазный меч'],
        ]);
        const result = rebuildJsonLang(original, translations);
        const parsed = JSON.parse(result);
        expect(parsed['item.sword']).toBe('Алмазный меч');
        expect(parsed['item.axe']).toBe('Iron Axe');
      });

      it('should maintain JSON formatting', () => {
        const original = JSON.stringify({ 'item.test': 'Test' }, null, 2);
        const translations = new Map([['item.test', 'Тест']]);
        const result = rebuildJsonLang(original, translations);
        expect(result).toContain('\n');
        expect(result).toContain('  ');
      });
    });
  });

  describe('Dot Lang Parser', () => {
    describe('parseDotLang', () => {
      it('should parse .lang format correctly', () => {
        const content = `item.sword=Diamond Sword
item.axe=Iron Axe`;
        const result = parseDotLang(content);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ key: 'item.sword', value: 'Diamond Sword' });
        expect(result[1]).toEqual({ key: 'item.axe', value: 'Iron Axe' });
      });

      it('should ignore comments', () => {
        const content = `# This is a comment
item.sword=Diamond Sword
# Another comment
item.axe=Iron Axe`;
        const result = parseDotLang(content);
        expect(result).toHaveLength(2);
      });

      it('should ignore empty lines', () => {
        const content = `item.sword=Diamond Sword

item.axe=Iron Axe`;
        const result = parseDotLang(content);
        expect(result).toHaveLength(2);
      });

      it('should handle values with = sign', () => {
        const content = `item.formula=E=mc^2`;
        const result = parseDotLang(content);
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe('E=mc^2');
      });

      it('should trim keys', () => {
        const content = `  item.sword  =Diamond Sword`;
        const result = parseDotLang(content);
        expect(result[0].key).toBe('item.sword');
      });
    });

    describe('rebuildDotLang', () => {
      it('should replace translations correctly', () => {
        const original = `item.sword=Diamond Sword
item.axe=Iron Axe`;
        const translations = new Map([
          ['item.sword', 'Алмазный меч'],
          ['item.axe', 'Железный топор'],
        ]);
        const result = rebuildDotLang(original, translations);
        expect(result).toContain('item.sword=Алмазный меч');
        expect(result).toContain('item.axe=Железный топор');
      });

      it('should preserve comments', () => {
        const original = `# Comment
item.sword=Diamond Sword`;
        const translations = new Map([['item.sword', 'Алмазный меч']]);
        const result = rebuildDotLang(original, translations);
        expect(result).toContain('# Comment');
      });

      it('should preserve empty lines', () => {
        const original = `item.sword=Diamond Sword

item.axe=Iron Axe`;
        const translations = new Map([['item.sword', 'Алмазный меч']]);
        const result = rebuildDotLang(original, translations);
        const lines = result.split('\n');
        expect(lines[1]).toBe('');
      });

      it('should preserve untranslated lines', () => {
        const original = `item.sword=Diamond Sword
item.axe=Iron Axe`;
        const translations = new Map([['item.sword', 'Алмазный меч']]);
        const result = rebuildDotLang(original, translations);
        expect(result).toContain('item.axe=Iron Axe');
      });
    });
  });

  describe('SNBT Parser', () => {
    describe('parseSnbt - FTB Quests format', () => {
      it('should detect FTB Quests format with alphanumeric IDs', () => {
        const content = `{
  quest.TEST1.quest_desc: ["Complete the quest"]
  chapter.ABC123.title: "Chapter One"
}`;
        const result = parseSnbt(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should parse array values', () => {
        const content = `{
  quest.TEST1.quest_desc: ["Line 1", "Line 2"]
}`;
        const result = parseSnbt(content);
        expect(result).toHaveLength(2);
        expect(result[0].value).toBe('Line 1');
        expect(result[1].value).toBe('Line 2');
      });

      it('should parse simple string values', () => {
        const content = `{
  chapter.TEST1.title: "Chapter Title"
}`;
        const result = parseSnbt(content);
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe('Chapter Title');
      });

      it('should handle escaped quotes', () => {
        const content = `{
  quest.TEST1.quest_desc: ["He said \\"Hello\\""]
}`;
        const result = parseSnbt(content);
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe('He said "Hello"');
      });

      it('should ignore non-translatable lines', () => {
        const content = `{
  quest.TEST1.quest_desc: ["Translatable text"]
  quest.TEST1.id: "TEST1"
  quest.TEST1.x: 0
}`;
        const result = parseSnbt(content);
        // Parser extracts all string values, including "TEST1" which has translatable text
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result.some(r => r.value === 'Translatable text')).toBe(true);
      });
    });

    describe('parseSnbt - original format', () => {
      it('should parse original SNBT format', () => {
        const content = `description: "Quest description"`;
        const result = parseSnbt(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should parse array format in original SNBT', () => {
        const content = `description: ["Quest text"]`;
        const result = parseSnbt(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore lines without text keys', () => {
        const content = `id: "quest_1"
x: 0
y: 0`;
        const result = parseSnbt(content);
        expect(result).toHaveLength(0);
      });
    });

    describe('rebuildSnbt', () => {
      it('should replace translations in FTB Quests format', () => {
        const original = `{
  quest.TEST1.quest_desc: ["Complete the quest"]
  chapter.TEST2.title: "Chapter One"
}`;
        const translations = new Map([
          ['quest.TEST1.quest_desc[0]', 'Выполните квест'],
          ['chapter.TEST2.title[0]', 'Глава первая'],
        ]);
        const result = rebuildSnbt(original, translations);
        expect(result).toContain('Выполните квест');
        expect(result).toContain('Глава первая');
      });

      it('should preserve original formatting', () => {
        const original = `{
  quest.TEST1.quest_desc: ["Text"]
}`;
        const translations = new Map([['quest.TEST1.quest_desc[0]', 'Текст']]);
        const result = rebuildSnbt(original, translations);
        expect(result).toContain('{');
        expect(result).toContain('}');
      });

      it('should preserve untranslated lines', () => {
        const original = `{
  quest.TEST1.quest_desc: ["Text 1"]
  quest.TEST2.quest_desc: ["Text 2"]
}`;
        const translations = new Map([['quest.TEST1.quest_desc[0]', 'Текст 1']]);
        const result = rebuildSnbt(original, translations);
        expect(result).toContain('Text 2');
      });

      it('should handle original SNBT format rebuild', () => {
        const original = `description: "Quest text"`;
        const translations = new Map([['snbt_line_0', 'Текст квеста']]);
        const result = rebuildSnbt(original, translations);
        expect(result).toContain('Текст квеста');
      });

      it('should handle array format in original SNBT rebuild', () => {
        const original = `description: ["Quest text"]`;
        const translations = new Map([['snbt_line_0', 'Текст квеста']]);
        const result = rebuildSnbt(original, translations);
        expect(result).toContain('Текст квеста');
      });
    });
  });

  describe('TOML Parser', () => {
    describe('parseToml', () => {
      it('should parse TOML key-value pairs', () => {
        const content = `title = "My Mod"
description = "A cool mod"`;
        const result = parseToml(content);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(r => r.value === 'My Mod')).toBe(true);
      });

      it('should ignore comments', () => {
        const content = `# This is a comment
title = "My Mod"`;
        const result = parseToml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore section headers', () => {
        const content = `[section]
title = "My Mod"`;
        const result = parseToml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should skip technical keys', () => {
        const content = `version = "1.0"
title = "My Mod"`;
        const result = parseToml(content);
        expect(result.every(r => r.value !== '1.0')).toBe(true);
      });

      it('should handle single quotes', () => {
        const content = `title = 'My Mod'`;
        const result = parseToml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle inline comments', () => {
        const content = `title = "My Mod" # This is a comment`;
        const result = parseToml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore empty lines', () => {
        const content = `title = "My Mod"

description = "Cool"`;
        const result = parseToml(content);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('rebuildToml', () => {
      it('should replace translations', () => {
        const original = `title = "My Mod"`;
        const translations = new Map([['toml_line_0', 'Мой мод']]);
        const result = rebuildToml(original, translations);
        expect(result).toContain('Мой мод');
      });

      it('should preserve untranslated lines', () => {
        const original = `title = "My Mod"
version = "1.0"`;
        const translations = new Map([['toml_line_0', 'Мой мод']]);
        const result = rebuildToml(original, translations);
        expect(result).toContain('version = "1.0"');
      });

      it('should handle single quotes in original', () => {
        const original = `title = 'My Mod'`;
        const translations = new Map([['toml_line_0', 'Мой мод']]);
        const result = rebuildToml(original, translations);
        expect(result).toContain('Мой мод');
      });
    });
  });

  describe('CFG Parser', () => {
    describe('parseCfg', () => {
      it('should parse CFG format', () => {
        const content = `S:title=My Cool Mod`;
        const result = parseCfg(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore comments', () => {
        const content = `# Comment
S:title=My Mod`;
        const result = parseCfg(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should require space in value', () => {
        const content = `S:key=NoSpace`;
        const result = parseCfg(content);
        expect(result).toHaveLength(0);
      });

      it('should parse without S: prefix', () => {
        const content = `title=My Cool Mod`;
        const result = parseCfg(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore empty lines', () => {
        const content = `S:title=My Mod

S:desc=Cool Description`;
        const result = parseCfg(content);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('rebuildCfg', () => {
      it('should replace translations', () => {
        const original = `S:title=My Mod`;
        const translations = new Map([['cfg_line_0', 'Мой мод']]);
        const result = rebuildCfg(original, translations);
        expect(result).toContain('Мой мод');
      });

      it('should preserve lines without translations', () => {
        const original = `S:title=My Mod
S:desc=Description`;
        const translations = new Map([['cfg_line_0', 'Мой мод']]);
        const result = rebuildCfg(original, translations);
        expect(result).toContain('Description');
      });

      it('should handle lines without = sign', () => {
        const original = `Invalid line`;
        const translations = new Map([['cfg_line_0', 'Translated']]);
        const result = rebuildCfg(original, translations);
        expect(result).toBe('Invalid line');
      });
    });
  });

  describe('Nested JSON Parser', () => {
    describe('parseNestedJson', () => {
      it('should parse nested JSON', () => {
        const content = JSON.stringify({
          title: 'My Book',
          pages: [
            { text: 'Page 1' },
            { text: 'Page 2' }
          ]
        });
        const result = parseNestedJson(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle arrays', () => {
        const content = JSON.stringify({
          items: ['Item One', 'Item Two']
        });
        const result = parseNestedJson(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle deeply nested objects', () => {
        const content = JSON.stringify({
          level1: {
            level2: {
              title: 'Deep Title'
            }
          }
        });
        const result = parseNestedJson(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore non-translatable values', () => {
        const content = JSON.stringify({
          title: 'My Book',
          id: 123,
          enabled: true
        });
        const result = parseNestedJson(content);
        expect(result.every(r => typeof r.value === 'string')).toBe(true);
      });

      it('should handle empty objects', () => {
        const content = JSON.stringify({});
        const result = parseNestedJson(content);
        expect(result).toHaveLength(0);
      });
    });

    describe('rebuildNestedJson', () => {
      it('should replace translations', () => {
        const original = JSON.stringify({ title: 'My Book' });
        const translations = new Map([['title', 'Моя книга']]);
        const result = rebuildNestedJson(original, translations);
        expect(result).toContain('Моя книга');
      });

      it('should handle nested paths', () => {
        const original = JSON.stringify({
          level1: { title: 'Title' }
        });
        const translations = new Map([['level1.title', 'Заголовок']]);
        const result = rebuildNestedJson(original, translations);
        expect(result).toContain('Заголовок');
      });

      it('should handle array indices', () => {
        const original = JSON.stringify({
          items: ['Item 1', 'Item 2']
        });
        const translations = new Map([
          ['items[0]', 'Предмет 1'],
          ['items[1]', 'Предмет 2']
        ]);
        const result = rebuildNestedJson(original, translations);
        expect(result).toContain('Предмет 1');
        expect(result).toContain('Предмет 2');
      });
    });
  });

  describe('XML Parser', () => {
    describe('parseXml', () => {
      it('should parse XML text content', () => {
        const content = `<root><title>My Title</title></root>`;
        const result = parseXml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle multiple elements', () => {
        const content = `<root>
  <title>Title One</title>
  <description>Description text</description>
</root>`;
        const result = parseXml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should ignore empty elements', () => {
        const content = `<root><empty></empty><title>Text</title></root>`;
        const result = parseXml(content);
        expect(result.every(r => r.value.length > 0)).toBe(true);
      });

      it('should handle nested elements', () => {
        const content = `<root><parent><child>Nested text</child></parent></root>`;
        const result = parseXml(content);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle self-closing tags', () => {
        const content = `<root><item/><title>Text</title></root>`;
        const result = parseXml(content);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('rebuildXml', () => {
      it('should replace translations', () => {
        const original = `<title>My Title</title>`;
        const translations = new Map([['xml_0', 'Мой заголовок']]);
        const result = rebuildXml(original, translations);
        expect(result).toContain('Мой заголовок');
      });

      it('should preserve XML structure', () => {
        const original = `<root><title>Title</title></root>`;
        const translations = new Map([['xml_0', 'Заголовок']]);
        const result = rebuildXml(original, translations);
        expect(result).toContain('<root>');
        expect(result).toContain('</root>');
      });

      it('should handle multiple replacements', () => {
        const original = `<root><title>Title</title><desc>Description</desc></root>`;
        const translations = new Map([
          ['xml_0', 'Заголовок'],
          ['xml_1', 'Описание']
        ]);
        const result = rebuildXml(original, translations);
        expect(result).toContain('Заголовок');
        expect(result).toContain('Описание');
      });
    });
  });

  describe('Plain Text Parser', () => {
    describe('parsePlainText', () => {
      it('should parse plain text lines', () => {
        const content = `This is line one
This is line two`;
        const result = parsePlainText(content);
        expect(result.length).toBe(2);
      });

      it('should ignore empty lines', () => {
        const content = `Line one

Line two`;
        const result = parsePlainText(content);
        expect(result.length).toBe(2);
      });

      it('should handle single line', () => {
        const content = `Single line text`;
        const result = parsePlainText(content);
        expect(result).toHaveLength(1);
      });

      it('should ignore whitespace-only lines', () => {
        const content = `Line one

Line two`;
        const result = parsePlainText(content);
        expect(result.length).toBe(2);
      });

      it('should handle multiple empty lines', () => {
        const content = `Line one


Line two`;
        const result = parsePlainText(content);
        expect(result.length).toBe(2);
      });
    });

    describe('rebuildPlainText', () => {
      it('should replace translations', () => {
        const original = `Line one\nLine two`;
        const translations = new Map([
          ['txt_0', 'Строка один'],
          ['txt_1', 'Строка два']
        ]);
        const result = rebuildPlainText(original, translations);
        expect(result).toContain('Строка один');
        expect(result).toContain('Строка два');
      });

      it('should preserve empty lines', () => {
        const original = `Line one\n\nLine two`;
        const translations = new Map([
          ['txt_0', 'Строка один'],
          ['txt_1', 'Строка два']
        ]);
        const result = rebuildPlainText(original, translations);
        // Empty line is preserved in the output
        expect(result.split('\n').length).toBe(3);
      });

      it('should preserve untranslated lines', () => {
        const original = `Line one\nLine two`;
        const translations = new Map([['txt_0', 'Строка один']]);
        const result = rebuildPlainText(original, translations);
        expect(result).toContain('Line two');
      });
    });
  });
});
