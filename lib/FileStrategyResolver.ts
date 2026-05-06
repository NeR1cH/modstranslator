/**
 * File strategy resolver - determines how to parse each file
 */

import { FileStrategy, StrategyResult } from './types';
import { isTargetLangFile } from './langParsers';

/** Files/paths to always skip */
const SKIP_PATTERNS = [
  /node_modules/, /\.git/, /\.(png|jpg|jpeg|gif|webp|ico|svg)$/i,
  /\.(mp3|ogg|wav|mp4|avi)$/i, /\.(class|zip|tar|gz)$/i,
  /\.(exe|dll|so|dylib)$/i, /META-INF/i,
];

/**
 * Strategy resolver interface
 */
interface IStrategyResolver {
  canHandle(path: string): boolean;
  getStrategy(path: string): FileStrategy;
  priority: number;
}

/**
 * Base strategy resolver
 */
abstract class BaseStrategyResolver implements IStrategyResolver {
  abstract canHandle(path: string): boolean;
  abstract getStrategy(path: string): FileStrategy;
  abstract priority: number;
}

/**
 * Skip resolver - highest priority
 */
class SkipResolver extends BaseStrategyResolver {
  priority = 1000;

  canHandle(path: string): boolean {
    const lower = path.toLowerCase();
    return SKIP_PATTERNS.some(p => p.test(path)) ||
           lower.includes('ru_ru') ||
           lower.includes('/ru/');
  }

  getStrategy(): FileStrategy {
    throw new Error('Should not call getStrategy on SkipResolver');
  }
}

/**
 * JAR file resolver
 */
class JarResolver extends BaseStrategyResolver {
  priority = 900;

  canHandle(path: string): boolean {
    return path.toLowerCase().endsWith('.jar');
  }

  getStrategy(): FileStrategy {
    return FileStrategy.JAR;
  }
}

/**
 * FTB Quests lang file resolver
 */
class FtbQuestsLangResolver extends BaseStrategyResolver {
  priority = 800;

  canHandle(path: string): boolean {
    const lower = path.toLowerCase();
    return lower.endsWith('.snbt') && lower.includes('/lang/');
  }

  getStrategy(): FileStrategy {
    return FileStrategy.SNBT;
  }
}

/**
 * JAR lang files resolver (en_us.json, en_us.lang)
 */
class JarLangResolver extends BaseStrategyResolver {
  priority = 700;

  canHandle(path: string): boolean {
    return isTargetLangFile(path);
  }

  getStrategy(): FileStrategy {
    return FileStrategy.LANG_JSON_OR_LANG;
  }
}

/**
 * SNBT resolver (FTB Quests, Better Questing)
 */
class SnbtResolver extends BaseStrategyResolver {
  priority = 600;

  canHandle(path: string): boolean {
    return path.toLowerCase().endsWith('.snbt');
  }

  getStrategy(): FileStrategy {
    return FileStrategy.SNBT;
  }
}

/**
 * Nested JSON resolver (Patchouli books, quests, dialogues)
 */
class NestedJsonResolver extends BaseStrategyResolver {
  priority = 500;

  canHandle(path: string): boolean {
    const lower = path.toLowerCase();
    return lower.endsWith('.json') && (
      lower.includes('patchouli') ||
      lower.includes('quest') ||
      lower.includes('dialogue') ||
      lower.includes('dialog') ||
      lower.includes('cutscene') ||
      lower.includes('cinematic') ||
      lower.includes('book') ||
      lower.includes('guide') ||
      lower.includes('advancement') ||
      lower.includes('story')
    );
  }

  getStrategy(): FileStrategy {
    return FileStrategy.NESTED_JSON;
  }
}

/**
 * Plain lang JSON resolver
 */
class LangJsonResolver extends BaseStrategyResolver {
  priority = 400;

  canHandle(path: string): boolean {
    const lower = path.toLowerCase();
    return lower.endsWith('.json') && lower.includes('/lang/');
  }

  getStrategy(): FileStrategy {
    return FileStrategy.LANG_JSON;
  }
}

/**
 * File strategy resolver using chain of responsibility pattern
 */
export class FileStrategyResolver {
  private resolvers: BaseStrategyResolver[];
  private skipResolver: SkipResolver;

  constructor() {
    this.skipResolver = new SkipResolver();
    this.resolvers = [
      new JarResolver(),
      new FtbQuestsLangResolver(),
      new JarLangResolver(),
      new SnbtResolver(),
      new NestedJsonResolver(),
      new LangJsonResolver(),
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get strategy for a file path
   * Returns null if file should be skipped
   */
  resolve(path: string): StrategyResult {
    // Check skip first
    if (this.skipResolver.canHandle(path)) {
      return { strategy: null, reason: 'File should be skipped' };
    }

    // Try each resolver in priority order
    for (const resolver of this.resolvers) {
      if (resolver.canHandle(path)) {
        return { strategy: resolver.getStrategy(path) };
      }
    }

    return { strategy: null, reason: 'No matching strategy found' };
  }

  /**
   * Check if file should be skipped
   */
  shouldSkip(path: string): boolean {
    return this.skipResolver.canHandle(path);
  }
}

// Singleton instance
let resolverInstance: FileStrategyResolver | null = null;

/**
 * Get or create resolver instance
 */
export function getStrategyResolver(): FileStrategyResolver {
  if (!resolverInstance) {
    resolverInstance = new FileStrategyResolver();
  }
  return resolverInstance;
}
