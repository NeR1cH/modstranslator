/**
 * Base cache class with common disk persistence logic
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger';
import { FileSystemError } from './errors';

export interface CacheConfig {
  cacheDir: string;
  fileName: string;
  version: string;
  autoSaveDelay?: number;
}

export abstract class BaseCache<T> {
  protected cacheDir: string;
  protected cacheFile: string;
  protected version: string;
  protected isDirty = false;
  protected saveTimer: NodeJS.Timeout | null = null;
  protected autoSaveDelay: number;
  protected logger = createLogger('cache');

  constructor(config: CacheConfig) {
    this.cacheDir = config.cacheDir;
    this.cacheFile = path.join(config.cacheDir, config.fileName);
    this.version = config.version;
    this.autoSaveDelay = config.autoSaveDelay ?? 5000;
    this.init();
  }

  /**
   * Initialize cache directory and load from disk
   */
  private init(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        this.logger.info('Created cache directory:', this.cacheDir);
      }
      this.loadFromDisk();
    } catch (error) {
      this.logger.error('Init error:', error);
      throw new FileSystemError('Failed to initialize cache', { error, cacheDir: this.cacheDir });
    }
  }

  /**
   * Load cache from disk - must be implemented by subclass
   */
  protected abstract loadFromDisk(): void;

  /**
   * Save cache to disk - must be implemented by subclass
   */
  protected abstract saveToDisk(): void;

  /**
   * Schedule a debounced save to disk
   */
  protected scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveToDisk();
    }, this.autoSaveDelay);
  }

  /**
   * Force save to disk immediately
   */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.isDirty) {
      this.saveToDisk();
    }
  }

  /**
   * Read JSON file safely
   */
  protected readJsonFile<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error('Failed to read JSON file:', filePath, error);
      return null;
    }
  }

  /**
   * Write JSON file safely
   */
  protected writeJsonFile(filePath: string, data: any): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      this.logger.error('Failed to write JSON file:', filePath, error);
      throw new FileSystemError('Failed to write cache file', { error, filePath });
    }
  }

  /**
   * Clear cache - must be implemented by subclass
   */
  abstract clear(): void;

  /**
   * Get cache statistics - must be implemented by subclass
   */
  abstract getStats(): any;
}
