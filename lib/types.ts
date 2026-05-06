/**
 * Core types and enums for the translation system
 */

import { LangEntry } from '@/types';

/**
 * File parsing strategies
 */
export enum FileStrategy {
  JAR = 'jar',
  LANG_JSON_OR_LANG = 'lang_json_or_lang',
  LANG_JSON = 'lang_json',
  SNBT = 'snbt',
  TOML = 'toml',
  CFG = 'cfg',
  NESTED_JSON = 'nested_json',
  XML = 'xml',
  TXT = 'txt',
  PROPERTIES = 'properties',
  YAML = 'yaml',
}

/**
 * File parser interface
 */
export interface IFileParser {
  parse(content: string): LangEntry[];
  rebuild(original: string, translations: Map<string, string>): string;
}

/**
 * Strategy resolver result
 */
export interface StrategyResult {
  strategy: FileStrategy | null;
  reason?: string;
}

/**
 * File processing context
 */
export interface FileContext {
  path: string;
  content: string;
  strategy: FileStrategy;
}

/**
 * Translation result
 */
export interface TranslationResult {
  success: boolean;
  translatedContent?: string;
  stringsCount?: number;
  error?: Error;
}
