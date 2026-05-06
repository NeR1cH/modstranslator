/**
 * Helper functions for parsers to reduce code duplication
 */

import { LangEntry } from '@/types';

/**
 * Parse file line by line with custom matcher
 */
export function parseLineByLine(
  content: string,
  matcher: (line: string, lineIndex: number) => LangEntry | null
): LangEntry[] {
  const entries: LangEntry[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const entry = matcher(lines[i], i);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Rebuild file line by line with custom replacer
 */
export function rebuildLineByLine(
  original: string,
  translations: Map<string, string>,
  replacer: (line: string, lineIndex: number, translations: Map<string, string>) => string
): string {
  const lines = original.split('\n');
  return lines.map((line, i) => replacer(line, i, translations)).join('\n');
}

/**
 * Check if text has translatable content
 */
export function hasTranslatableText(s: string): boolean {
  return /[a-zA-Z]/.test(s) && s.trim().length > 1;
}

/**
 * Extract quoted string from text
 */
export function extractQuotedString(text: string): string | null {
  const match = text.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (!match) return null;
  return match[1].replace(/\\"/g, '"');
}

/**
 * Escape string for JSON/SNBT format
 */
export function escapeQuotes(text: string): string {
  return text.replace(/"/g, '\\"');
}

/**
 * Unescape string from JSON/SNBT format
 */
export function unescapeQuotes(text: string): string {
  return text.replace(/\\"/g, '"');
}

/**
 * Parse key-value line with separator
 */
export function parseKeyValue(
  line: string,
  separator: string | RegExp
): { key: string; value: string } | null {
  const parts = typeof separator === 'string'
    ? line.split(separator)
    : line.split(separator);

  if (parts.length < 2) return null;

  const key = parts[0].trim();
  const value = parts.slice(1).join(typeof separator === 'string' ? separator : '').trim();

  return { key, value };
}

/**
 * Check if line is comment
 */
export function isComment(line: string, commentPrefix: string | string[]): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  const prefixes = Array.isArray(commentPrefix) ? commentPrefix : [commentPrefix];
  return prefixes.some(prefix => trimmed.startsWith(prefix));
}
