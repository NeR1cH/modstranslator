/**
 * Centralized logging system with levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.INFO : level;
  }

  debug(...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[${this.context}]`, ...args);
    }
  }

  info(...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[${this.context}]`, ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.context}]`, ...args);
    }
  }

  error(...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.context}]`, ...args);
    }
  }

  group(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.group(`[${this.context}] ${label}`);
    }
  }

  groupEnd(): void {
    if (this.level <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string, level?: LogLevel): Logger {
  return new Logger(context, level);
}

/**
 * Global logger instances
 */
export const loggers = {
  deepl: createLogger('deepl'),
  cache: createLogger('cache'),
  fragmentCache: createLogger('fragment-cache'),
  rateLimiter: createLogger('rate-limiter'),
  modpackProcessor: createLogger('modpackProcessor'),
  jarProcessor: createLogger('jarProcessor'),
  langParsers: createLogger('langParsers'),
  security: createLogger('security'),
};
