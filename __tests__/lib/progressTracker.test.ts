/**
 * Tests for ProgressTracker
 */

import { ProgressTracker } from '../../lib/progressTracker';
import fs from 'fs';
import path from 'path';

const PROGRESS_DIR = path.join(process.cwd(), '.translation-cache');
const PROGRESS_FILE = path.join(PROGRESS_DIR, 'progress.json');

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
    // Clean up progress file before each test
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
  });

  describe('start', () => {
    it('should start new progress tracking', () => {
      tracker.start('test.snbt', 'content here', 100);

      const progress = tracker.getProgress();
      expect(progress).toEqual({
        completed: 0,
        total: 100
      });
    });

    it('should resume existing progress for same file', () => {
      // First run
      tracker.start('test.snbt', 'content here', 100);
      tracker.markCompleted('item_1');
      tracker.markCompleted('item_2');

      // Second run with same file
      const tracker2 = new ProgressTracker();
      tracker2.start('test.snbt', 'content here', 100);

      const progress = tracker2.getProgress();
      expect(progress).toEqual({
        completed: 2,
        total: 100
      });
    });

    it('should start fresh for different file content', () => {
      // First run
      tracker.start('test.snbt', 'content here', 100);
      tracker.markCompleted('item_1');

      // Second run with different content
      const tracker2 = new ProgressTracker();
      tracker2.start('test.snbt', 'different content', 100);

      const progress = tracker2.getProgress();
      expect(progress).toEqual({
        completed: 0,
        total: 100
      });
    });
  });

  describe('markCompleted', () => {
    it('should mark item as completed', () => {
      tracker.start('test.snbt', 'content', 10);
      tracker.markCompleted('item_1');

      expect(tracker.isCompleted('item_1')).toBe(true);
      expect(tracker.getProgress()?.completed).toBe(1);
    });

    it('should not duplicate completed items', () => {
      tracker.start('test.snbt', 'content', 10);
      tracker.markCompleted('item_1');
      tracker.markCompleted('item_1');
      tracker.markCompleted('item_1');

      expect(tracker.getProgress()?.completed).toBe(1);
    });

    it('should save progress to disk', () => {
      tracker.start('test.snbt', 'content', 10);
      tracker.markCompleted('item_1');

      expect(fs.existsSync(PROGRESS_FILE)).toBe(true);

      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      expect(data.completed).toBe(1);
      expect(data.completedIds).toContain('item_1');
    });
  });

  describe('isCompleted', () => {
    it('should return true for completed items', () => {
      tracker.start('test.snbt', 'content', 10);
      tracker.markCompleted('item_1');

      expect(tracker.isCompleted('item_1')).toBe(true);
    });

    it('should return false for non-completed items', () => {
      tracker.start('test.snbt', 'content', 10);

      expect(tracker.isCompleted('item_1')).toBe(false);
    });

    it('should return false when no tracking started', () => {
      expect(tracker.isCompleted('item_1')).toBe(false);
    });
  });

  describe('getProgress', () => {
    it('should return current progress', () => {
      tracker.start('test.snbt', 'content', 100);
      tracker.markCompleted('item_1');
      tracker.markCompleted('item_2');
      tracker.markCompleted('item_3');

      const progress = tracker.getProgress();
      expect(progress).toEqual({
        completed: 3,
        total: 100
      });
    });

    it('should return null when no tracking started', () => {
      expect(tracker.getProgress()).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear progress state', () => {
      tracker.start('test.snbt', 'content', 10);
      tracker.markCompleted('item_1');
      tracker.clear();

      expect(tracker.getProgress()).toBeNull();
    });

    it('should delete progress file', () => {
      tracker.start('test.snbt', 'content', 10);
      tracker.markCompleted('item_1');

      expect(fs.existsSync(PROGRESS_FILE)).toBe(true);

      tracker.clear();

      expect(fs.existsSync(PROGRESS_FILE)).toBe(false);
    });
  });

  describe('getResumeMessage', () => {
    it('should return resume message with progress', () => {
      tracker.start('test.snbt', 'content', 224);
      tracker.markCompleted('item_1');
      tracker.markCompleted('item_2');

      const message = tracker.getResumeMessage();
      expect(message).toContain('2/224');
      expect(message).toContain('60 секунд');
    });

    it('should return null when no tracking started', () => {
      expect(tracker.getResumeMessage()).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist progress across instances', () => {
      // First instance
      const tracker1 = new ProgressTracker();
      tracker1.start('test.snbt', 'content', 100);
      tracker1.markCompleted('item_1');
      tracker1.markCompleted('item_2');

      // Second instance
      const tracker2 = new ProgressTracker();
      tracker2.start('test.snbt', 'content', 100);

      expect(tracker2.isCompleted('item_1')).toBe(true);
      expect(tracker2.isCompleted('item_2')).toBe(true);
      expect(tracker2.getProgress()?.completed).toBe(2);
    });

    it('should ignore old progress files (>24 hours)', () => {
      // Create old progress file
      tracker.start('test.snbt', 'content', 100);
      tracker.markCompleted('item_1');

      // Manually modify timestamp to be 25 hours old
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      data.timestamp = Date.now() - (25 * 60 * 60 * 1000);
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data));

      // New instance should start fresh
      const tracker2 = new ProgressTracker();
      tracker2.start('test.snbt', 'content', 100);

      expect(tracker2.getProgress()?.completed).toBe(0);
    });
  });
});
