/**
 * File translator - handles translation of individual files
 */

import { LangEntry } from '@/types';
import { FileStrategy, TranslationResult } from './types';
import {
  parseJsonLang, parseDotLang, parseSnbt, parseToml,
  parseCfg, parseNestedJson, parseXml, parsePlainText,
  rebuildJsonLang, rebuildDotLang, rebuildSnbt, rebuildToml,
  rebuildCfg, rebuildNestedJson, rebuildXml, rebuildPlainText,
} from './langParsers';
import { translateTexts } from './deepl';
import { createLogger } from './logger';
import { ParseError } from './errors';

const logger = createLogger('fileTranslator');

/**
 * Extract entries from file content based on strategy
 */
export function extractEntries(
  path: string,
  content: string,
  strategy: FileStrategy
): LangEntry[] {
  try {
    switch (strategy) {
      case FileStrategy.LANG_JSON_OR_LANG:
        return path.endsWith('.json') ? parseJsonLang(content) : parseDotLang(content);
      case FileStrategy.LANG_JSON:
        return parseJsonLang(content);
      case FileStrategy.SNBT:
        return parseSnbt(content);
      case FileStrategy.TOML:
        return parseToml(content);
      case FileStrategy.CFG:
        return parseCfg(content);
      case FileStrategy.NESTED_JSON:
        return parseNestedJson(content);
      case FileStrategy.XML:
        return parseXml(content);
      case FileStrategy.TXT:
        return parsePlainText(content);
      default:
        return [];
    }
  } catch (error) {
    logger.error('Failed to extract entries from', path, error);
    throw new ParseError(`Failed to parse file: ${path}`, { path, strategy, error });
  }
}

/**
 * Rebuild file content with translations
 */
export function rebuildContent(
  path: string,
  original: string,
  translations: Map<string, string>,
  strategy: FileStrategy
): string {
  try {
    switch (strategy) {
      case FileStrategy.LANG_JSON_OR_LANG:
      case FileStrategy.LANG_JSON:
        return path.endsWith('.json')
          ? rebuildJsonLang(original, translations)
          : rebuildDotLang(original, translations);
      case FileStrategy.SNBT:
        return rebuildSnbt(original, translations);
      case FileStrategy.TOML:
        return rebuildToml(original, translations);
      case FileStrategy.CFG:
        return rebuildCfg(original, translations);
      case FileStrategy.NESTED_JSON:
        return rebuildNestedJson(original, translations);
      case FileStrategy.XML:
        return rebuildXml(original, translations);
      case FileStrategy.TXT:
        return rebuildPlainText(original, translations);
      default:
        return original;
    }
  } catch (error) {
    logger.error('Failed to rebuild content for', path, error);
    throw new ParseError(`Failed to rebuild file: ${path}`, { path, strategy, error });
  }
}

/**
 * Translate a single file
 */
export async function translateFile(
  path: string,
  content: string,
  strategy: FileStrategy
): Promise<TranslationResult> {
  logger.info('Translating file:', path, '| Strategy:', strategy);

  try {
    // Extract entries
    const entries = extractEntries(path, content, strategy);
    logger.debug('Extracted entries:', entries.length);

    if (entries.length === 0) {
      logger.debug('No translatable entries found');
      return { success: false };
    }

    // Translate
    const values = entries.map(e => e.value);
    const translated = await translateTexts(values);
    logger.debug('Translation complete, received:', translated.length);

    // Build translation map
    const transMap = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));

    // Rebuild content
    const newContent = rebuildContent(path, content, transMap, strategy);
    logger.debug('Content rebuilt, length:', newContent.length);

    return {
      success: true,
      translatedContent: newContent,
      stringsCount: entries.length,
    };
  } catch (error) {
    logger.error('Translation failed for', path, error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
