import { QUEUE_LIMITS, ERROR_MESSAGES, formatBytes } from '@/lib/queueLimits';

describe('queueLimits', () => {
  describe('QUEUE_LIMITS', () => {
    it('should have correct limit values', () => {
      expect(QUEUE_LIMITS.MAX_FILES).toBe(Infinity);
      expect(QUEUE_LIMITS.MAX_TOTAL_SIZE).toBe(5 * 1024 * 1024 * 1024);
      expect(QUEUE_LIMITS.MAX_FILE_SIZE).toBe(1.5 * 1024 * 1024 * 1024);
      expect(QUEUE_LIMITS.MAX_CONCURRENT).toBe(3);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have error messages', () => {
      expect(ERROR_MESSAGES.QUEUE_FULL).toBeDefined();
      expect(ERROR_MESSAGES.QUEUE_SIZE_EXCEEDED).toBeDefined();
      expect(ERROR_MESSAGES.FILE_TOO_LARGE).toBeDefined();
      expect(ERROR_MESSAGES.UNSUPPORTED_FORMAT).toBeDefined();
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500.00 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.00 GB');
    });
  });
});
