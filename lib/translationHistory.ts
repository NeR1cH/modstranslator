// ============================================================
// BLOCK: Translation History Storage
// Saves translation results to localStorage for later access
// ============================================================

export interface HistoryEntry {
  id: string;
  fileName: string;
  outputFileName: string;
  timestamp: number;
  stringsCount: number;
  format: string;
  resultBase64: string;
  fileSize: number;
}

const STORAGE_KEY = 'mod_translator_history';
const MAX_ENTRIES = 50; // Limit to prevent localStorage overflow
const MAX_ENTRY_SIZE = 10 * 1024 * 1024; // 10MB per entry (base64)

class TranslationHistory {
  /**
   * Save a translation to history
   */
  async save(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Check entry size
      if (entry.resultBase64.length > MAX_ENTRY_SIZE) {
        console.warn('[history] Entry too large, skipping:', entry.fileName);
        return;
      }

      const history = await this.getAll();

      const newEntry: HistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };

      // Add to beginning (newest first)
      history.unshift(newEntry);

      // Limit number of entries
      if (history.length > MAX_ENTRIES) {
        history.splice(MAX_ENTRIES);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      console.log('[history] Saved entry:', newEntry.fileName);
    } catch (error) {
      console.error('[history] Failed to save:', error);
      // If localStorage is full, try to clear old entries
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[history] Storage quota exceeded, clearing old entries');
        await this.clearOldEntries(10);
      }
    }
  }

  /**
   * Get all history entries
   */
  async getAll(): Promise<HistoryEntry[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const history: HistoryEntry[] = JSON.parse(data);
      return history;
    } catch (error) {
      console.error('[history] Failed to load:', error);
      return [];
    }
  }

  /**
   * Get a single entry by ID
   */
  async getById(id: string): Promise<HistoryEntry | null> {
    const history = await this.getAll();
    return history.find(e => e.id === id) || null;
  }

  /**
   * Delete an entry by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const history = await this.getAll();
      const filtered = history.filter(e => e.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      console.log('[history] Deleted entry:', id);
    } catch (error) {
      console.error('[history] Failed to delete:', error);
    }
  }

  /**
   * Clear all history
   */
  async clear(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[history] Cleared all entries');
    } catch (error) {
      console.error('[history] Failed to clear:', error);
    }
  }

  /**
   * Clear oldest N entries
   */
  async clearOldEntries(count: number): Promise<void> {
    try {
      const history = await this.getAll();
      if (history.length <= count) {
        await this.clear();
        return;
      }

      const remaining = history.slice(0, history.length - count);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      console.log(`[history] Cleared ${count} old entries`);
    } catch (error) {
      console.error('[history] Failed to clear old entries:', error);
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { count: number; totalSize: number } {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return { count: 0, totalSize: 0 };
      }

      const history: HistoryEntry[] = JSON.parse(data);
      const totalSize = new Blob([data]).size;

      return {
        count: history.length,
        totalSize
      };
    } catch (error) {
      console.error('[history] Failed to get stats:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}

// Singleton instance
let historyInstance: TranslationHistory | null = null;

/**
 * Get or create history instance
 */
export function getTranslationHistory(): TranslationHistory {
  if (!historyInstance) {
    historyInstance = new TranslationHistory();
  }
  return historyInstance;
}
