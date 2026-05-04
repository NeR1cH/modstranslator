import {
  sanitizePath,
  sanitizeFileName,
  safeJsonParse,
  validateFileType,
  validateBase64Size,
  MAX_BASE64_SIZE,
} from '@/lib/security';

describe('security', () => {
  describe('sanitizePath', () => {
    it('should allow safe paths in assets/', () => {
      expect(sanitizePath('assets/mod/lang/en_us.json')).toBe('assets/mod/lang/en_us.json');
    });

    it('should allow safe paths in config/', () => {
      expect(sanitizePath('config/ftbquests/quests/lang/en_us.snbt')).toBe('config/ftbquests/quests/lang/en_us.snbt');
    });

    it('should allow safe paths in data/', () => {
      expect(sanitizePath('data/mod/recipes/test.json')).toBe('data/mod/recipes/test.json');
    });

    it('should block path traversal with ../', () => {
      expect(() => sanitizePath('../../etc/passwd')).toThrow('Invalid file path');
    });

    it('should remove .. from path', () => {
      // sanitizePath removes all .. occurrences, leaving multiple slashes
      const result = sanitizePath('assets/../../../etc/passwd');
      expect(result).toBe('assets////etc/passwd');
    });

    it('should remove leading slashes', () => {
      expect(sanitizePath('/assets/mod/lang/en_us.json')).toBe('assets/mod/lang/en_us.json');
    });

    it('should normalize backslashes to forward slashes', () => {
      expect(sanitizePath('assets\\mod\\lang\\en_us.json')).toBe('assets/mod/lang/en_us.json');
    });

    it('should throw for paths outside safe directories', () => {
      expect(() => sanitizePath('etc/passwd')).toThrow('Invalid file path');
      expect(() => sanitizePath('home/user/file.txt')).toThrow('Invalid file path');
    });

    it('should allow paths in saves/', () => {
      expect(sanitizePath('saves/world/data.json')).toBe('saves/world/data.json');
    });

    it('should allow paths in local/', () => {
      expect(sanitizePath('local/cache/file.json')).toBe('local/cache/file.json');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove < and > characters', () => {
      expect(sanitizeFileName('file<script>.txt')).toBe('filescript.txt');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeFileName('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should remove data: protocol', () => {
      expect(sanitizeFileName('data:text/html,<script>alert(1)</script>')).toBe('text/html,scriptalert(1)/script');
    });

    it('should limit length to 255 characters', () => {
      const longName = 'a'.repeat(300);
      expect(sanitizeFileName(longName)).toHaveLength(255);
    });

    it('should handle normal filenames', () => {
      expect(sanitizeFileName('normal-file_123.txt')).toBe('normal-file_123.txt');
    });

    it('should be case-insensitive for protocols', () => {
      expect(sanitizeFileName('JavaScript:alert(1)')).toBe('alert(1)');
      expect(sanitizeFileName('DATA:text/html')).toBe('text/html');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should remove __proto__ property', () => {
      const result = safeJsonParse('{"__proto__": {"polluted": true}, "key": "value"}');
      // __proto__ is deleted, so accessing it returns the prototype object
      // We check that the polluted property is not there
      expect(result).toHaveProperty('key', 'value');
      expect(Object.getOwnPropertyDescriptor(result, '__proto__')).toBeUndefined();
    });

    it('should remove constructor property', () => {
      const result = safeJsonParse('{"constructor": {"polluted": true}, "key": "value"}');
      // constructor is deleted, so it falls back to Object.prototype.constructor
      expect(result).toHaveProperty('key', 'value');
      expect(Object.getOwnPropertyDescriptor(result, 'constructor')).toBeUndefined();
    });

    it('should remove prototype property', () => {
      const result = safeJsonParse('{"prototype": {"polluted": true}, "key": "value"}');
      expect(result).toHaveProperty('key', 'value');
      expect(Object.getOwnPropertyDescriptor(result, 'prototype')).toBeUndefined();
    });

    it('should throw on invalid JSON', () => {
      expect(() => safeJsonParse('invalid json')).toThrow();
    });

    it('should handle arrays', () => {
      const result = safeJsonParse('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', () => {
      const result = safeJsonParse('{"outer": {"inner": "value"}}');
      expect(result).toEqual({ outer: { inner: 'value' } });
    });
  });

  describe('validateFileType', () => {
    it('should validate ZIP magic bytes', () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]);
      expect(validateFileType(zipBuffer, 'zip')).toBe(true);
    });

    it('should reject invalid ZIP magic bytes', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(validateFileType(invalidBuffer, 'zip')).toBe(false);
    });

    it('should validate JSON starting with {', () => {
      const jsonBuffer = Buffer.from('{"key": "value"}');
      expect(validateFileType(jsonBuffer, 'json')).toBe(true);
    });

    it('should validate JSON starting with [', () => {
      const jsonBuffer = Buffer.from('[1, 2, 3]');
      expect(validateFileType(jsonBuffer, 'json')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      const invalidBuffer = Buffer.from('invalid');
      expect(validateFileType(invalidBuffer, 'json')).toBe(false);
    });

    it('should handle empty buffers', () => {
      const emptyBuffer = Buffer.from([]);
      expect(validateFileType(emptyBuffer, 'zip')).toBe(false);
      expect(validateFileType(emptyBuffer, 'json')).toBe(false);
    });

    it('should handle buffers smaller than 4 bytes for ZIP', () => {
      const smallBuffer = Buffer.from([0x50, 0x4B]);
      expect(validateFileType(smallBuffer, 'zip')).toBe(false);
    });
  });

  describe('validateBase64Size', () => {
    it('should allow valid sizes', () => {
      const validBase64 = 'a'.repeat(1000);
      expect(() => validateBase64Size(validBase64)).not.toThrow();
    });

    it('should throw for sizes exceeding MAX_BASE64_SIZE', () => {
      // Mock a string that exceeds the limit by checking length directly
      const oversizedLength = MAX_BASE64_SIZE + 1;
      const oversizedBase64 = { length: oversizedLength };
      expect(() => validateBase64Size(oversizedBase64 as any)).toThrow('File too large (max 800MB)');
    });

    it('should allow reasonable file sizes', () => {
      // 10MB string - well within limits
      const reasonableBase64 = 'a'.repeat(10 * 1024 * 1024);
      expect(() => validateBase64Size(reasonableBase64)).not.toThrow();
    });

    it('should handle empty strings', () => {
      expect(() => validateBase64Size('')).not.toThrow();
    });
  });
});
