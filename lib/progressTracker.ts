/**
 * Progress Tracker - saves translation progress to resume after rate limit errors
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ProgressState {
  fileHash: string;
  fileName: string;
  total: number;
  completed: number;
  completedIds: string[];
  timestamp: number;
}

const PROGRESS_DIR = path.join(process.cwd(), '.translation-cache');
const PROGRESS_FILE = path.join(PROGRESS_DIR, 'progress.json');

export class ProgressTracker {
  private state: ProgressState | null = null;

  constructor() {
    this.ensureDir();
  }

  /**
   * Ensure progress directory exists
   */
  private ensureDir(): void {
    if (!fs.existsSync(PROGRESS_DIR)) {
      fs.mkdirSync(PROGRESS_DIR, { recursive: true });
    }
  }

  /**
   * Generate unique hash for file content
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Start tracking progress for a file
   */
  start(fileName: string, content: string, total: number): void {
    const fileHash = this.hashContent(content);

    // Check if we have existing progress for this file
    const existing = this.load();
    if (existing && existing.fileHash === fileHash && existing.fileName === fileName) {
      // Resume existing progress
      this.state = existing;
      console.log(`[progress] Resuming translation: ${existing.completed}/${existing.total} completed`);
    } else {
      // Start new progress
      this.state = {
        fileHash,
        fileName,
        total,
        completed: 0,
        completedIds: [],
        timestamp: Date.now()
      };
      console.log(`[progress] Starting new translation: 0/${total}`);
    }
  }

  /**
   * Mark an item as completed
   */
  markCompleted(id: string): void {
    if (!this.state) return;

    if (!this.state.completedIds.includes(id)) {
      this.state.completedIds.push(id);
      this.state.completed = this.state.completedIds.length;
      this.state.timestamp = Date.now();
      this.save();
    }
  }

  /**
   * Check if an item is already completed
   */
  isCompleted(id: string): boolean {
    if (!this.state) return false;
    return this.state.completedIds.includes(id);
  }

  /**
   * Get current progress
   */
  getProgress(): { completed: number; total: number } | null {
    if (!this.state) return null;
    return {
      completed: this.state.completed,
      total: this.state.total
    };
  }

  /**
   * Save progress to disk
   */
  private save(): void {
    if (!this.state) return;

    try {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
      console.log(`[progress] Saved: ${this.state.completed}/${this.state.total}`);
    } catch (error) {
      console.error('[progress] Failed to save:', error);
    }
  }

  /**
   * Load progress from disk
   */
  private load(): ProgressState | null {
    try {
      if (fs.existsSync(PROGRESS_FILE)) {
        const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
        const state = JSON.parse(data) as ProgressState;

        // Check if progress is not too old (24 hours)
        const age = Date.now() - state.timestamp;
        if (age > 24 * 60 * 60 * 1000) {
          console.log('[progress] Progress file too old, starting fresh');
          return null;
        }

        return state;
      }
    } catch (error) {
      console.error('[progress] Failed to load:', error);
    }
    return null;
  }

  /**
   * Clear progress (called when translation completes successfully)
   */
  clear(): void {
    this.state = null;
    try {
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('[progress] Cleared progress file');
      }
    } catch (error) {
      console.error('[progress] Failed to clear:', error);
    }
  }

  /**
   * Get resume message for user
   */
  getResumeMessage(): string | null {
    if (!this.state) return null;

    return `Перевод приостановлен на строке ${this.state.completed}/${this.state.total}. ` +
           `Перезапустите через 60 секунд — продолжится автоматически.`;
  }
}

// Singleton instance
let instance: ProgressTracker | null = null;

export function getProgressTracker(): ProgressTracker {
  if (!instance) {
    instance = new ProgressTracker();
  }
  return instance;
}
