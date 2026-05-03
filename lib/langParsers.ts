import { LangEntry } from '@/types';
import { safeJsonParse } from './security';

// ============================================================
// BLOCK: Helpers
// ============================================================

export function hasTranslatableText(s: string): boolean {
  return /[a-zA-Z]/.test(s) && s.trim().length > 1;
}

export function detectFormat(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json'))  return 'json';
  if (lower.endsWith('.lang'))  return 'lang';
  if (lower.endsWith('.snbt'))  return 'snbt';
  if (lower.endsWith('.toml'))  return 'toml';
  if (lower.endsWith('.cfg'))   return 'cfg';
  if (lower.endsWith('.txt'))   return 'txt';
  if (lower.endsWith('.xml'))   return 'xml';
  if (lower.endsWith('.properties')) return 'properties';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
  return null;
}

// ============================================================
// BLOCK: JSON lang parser (Minecraft 1.13+)
// ============================================================
export function parseJsonLang(content: string): LangEntry[] {
  const obj = safeJsonParse(content) as Record<string, unknown>;
  const entries: LangEntry[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && hasTranslatableText(value)) {
      entries.push({ key, value });
    }
  }
  return entries;
}

export function rebuildJsonLang(original: string, translations: Map<string, string>): string {
  const obj = safeJsonParse(original) as Record<string, unknown>;
  for (const [key] of Object.entries(obj)) {
    if (translations.has(key)) obj[key] = translations.get(key);
  }
  return JSON.stringify(obj, null, 2);
}

// ============================================================
// BLOCK: .lang parser (Minecraft pre-1.13)
// ============================================================
export function parseDotLang(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key   = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1);
    if (hasTranslatableText(value)) entries.push({ key, value });
  }
  return entries;
}

export function rebuildDotLang(original: string, translations: Map<string, string>): string {
  return original.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return line;
    const key = trimmed.substring(0, eqIdx).trim();
    return translations.has(key) ? `${key}=${translations.get(key)}` : line;
  }).join('\n');
}

// ============================================================
// BLOCK: SNBT parser (FTB Quests, Better Questing)
// ============================================================
const SNBT_TEXT_KEYS = /\b(title|subtitle|description|text|name|header|footer|desc)\b\s*:/i;

export function parseSnbt(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  content.split('\n').forEach((line, i) => {
    if (!SNBT_TEXT_KEYS.test(line)) return;
    // Match both simple format: description: "text"
    // And array format: description: ["text"]
    const simpleMatch = line.match(/:\s*"((?:[^"\\]|\\.)*)"/);
    const arrayMatch = line.match(/:\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/);
    const match = arrayMatch || simpleMatch;
    if (!match) return;
    const value = match[1].replace(/\\"/g, '"');
    if (hasTranslatableText(value)) entries.push({ key: `snbt_line_${i}`, value });
  });
  return entries;
}

export function rebuildSnbt(original: string, translations: Map<string, string>): string {
  return original.split('\n').map((line, i) => {
    const key = `snbt_line_${i}`;
    if (!translations.has(key)) return line;
    const translated = translations.get(key)!.replace(/"/g, '\\"');
    // Handle both simple format: description: "text"
    // And array format: description: ["text"]
    if (/:\s*\[/.test(line)) {
      return line.replace(/:\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/, `: ["${translated}"]`);
    }
    return line.replace(/:\s*"((?:[^"\\]|\\.)*)"/, `: "${translated}"`);
  }).join('\n');
}

// ============================================================
// BLOCK: TOML parser (Forge mod configs)
// ============================================================
const TOML_SKIP_KEYS = /^(class|id|type|version|mod|namespace|registry|path|file|url|key|category)$/i;

export function parseToml(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  content.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) return;
    const match = trimmed.match(/^([^=]+?)\s*=\s*["'](.+?)["']\s*(?:#.*)?$/);
    if (!match) return;
    const keyName = match[1].trim().split('.').pop() ?? '';
    const value   = match[2];
    if (TOML_SKIP_KEYS.test(keyName)) return;
    if (!hasTranslatableText(value)) return;
    entries.push({ key: `toml_line_${i}`, value });
  });
  return entries;
}

export function rebuildToml(original: string, translations: Map<string, string>): string {
  return original.split('\n').map((line, i) => {
    const key = `toml_line_${i}`;
    if (!translations.has(key)) return line;
    const translated = translations.get(key)!;
    return line.replace(/=\s*["'](.+?)["']/, `= "${translated}"`);
  }).join('\n');
}

// ============================================================
// BLOCK: CFG parser (old Forge configs)
// ============================================================
export function parseCfg(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  content.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^S:[^=]+=(.+)$/) ?? trimmed.match(/^[^=]+=(.+)$/);
    if (!match) return;
    const value = match[1].trim();
    if (hasTranslatableText(value) && value.includes(' ')) {
      entries.push({ key: `cfg_line_${i}`, value });
    }
  });
  return entries;
}

export function rebuildCfg(original: string, translations: Map<string, string>): string {
  return original.split('\n').map((line, i) => {
    const key = `cfg_line_${i}`;
    if (!translations.has(key)) return line;
    const eqIdx = line.indexOf('=');
    return eqIdx === -1 ? line : line.substring(0, eqIdx + 1) + translations.get(key);
  }).join('\n');
}

// ============================================================
// BLOCK: Nested JSON parser (quests, dialogues, patchouli books)
// ============================================================
const JSON_TEXT_KEYS = new Set([
  'title','name','description','text','subtitle','tooltip',
  'desc','header','body','footer','message','dialogue',
  'displayName','display_name','questName','rewardName',
  'landing_text','subtitle_text',
]);

export function parseNestedJson(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  function traverse(obj: unknown, path: string) {
    if (typeof obj === 'string') {
      if (hasTranslatableText(obj)) entries.push({ key: path, value: obj });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => traverse(item, `${path}[${i}]`));
    } else if (obj && typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
        traverse(val, path ? `${path}.${key}` : key);
      }
    }
  }
  traverse(safeJsonParse(content), '');
  return entries;
}

export function rebuildNestedJson(original: string, translations: Map<string, string>): string {
  function replaceInObj(obj: unknown, path: string): unknown {
    if (typeof obj === 'string') return translations.get(path) ?? obj;
    if (Array.isArray(obj)) return obj.map((item, i) => replaceInObj(item, `${path}[${i}]`));
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = replaceInObj(val, path ? `${path}.${key}` : key);
      }
      return result;
    }
    return obj;
  }
  return JSON.stringify(replaceInObj(safeJsonParse(original), ''), null, 2);
}

// ============================================================
// BLOCK: XML parser (dialogue/cutscene formats)
// ============================================================
export function parseXml(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  // Match text between tags, excluding CDATA and comments
  const regex = />([^<]+)</g;
  let match; let i = 0;

  // Remove CDATA sections and comments before parsing
  const cleaned = content
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  while ((match = regex.exec(cleaned)) !== null) {
    const value = match[1].trim();
    // Skip empty strings and XML declarations
    if (value && !value.startsWith('<?') && !value.startsWith('<!') && hasTranslatableText(value)) {
      entries.push({ key: `xml_${i++}`, value });
    }
  }
  return entries;
}

export function rebuildXml(original: string, translations: Map<string, string>): string {
  // Reuse parseXml to get the exact same keys as the parse phase,
  // then build a value→key lookup so replace doesn't need its own counter.
  const entries = parseXml(original);
  const keyByValue = new Map(entries.map(e => [e.value, e.key]));

  return original.replace(/>([^<]+)</g, (full, content) => {
    const value = content.trim();
    const key = keyByValue.get(value);
    if (key && translations.has(key)) {
      // Preserve original whitespace around the translated text
      const leadingSpace = content.match(/^\s*/)?.[0] || '';
      const trailingSpace = content.match(/\s*$/)?.[0] || '';
      return `>${leadingSpace}${translations.get(key)}${trailingSpace}<`;
    }
    return full;
  });
}

// ============================================================
// BLOCK: Plain text parser (subtitles, cutscene scripts)
// ============================================================
export function parsePlainText(content: string): LangEntry[] {
  return content.split('\n')
    .map((line, i) => ({ key: `txt_${i}`, value: line }))
    .filter(e => hasTranslatableText(e.value));
}

export function rebuildPlainText(original: string, translations: Map<string, string>): string {
  return original.split('\n')
    .map((line, i) => translations.get(`txt_${i}`) ?? line)
    .join('\n');
}

// ============================================================
// BLOCK: .properties parser (Java properties format)
// ============================================================
export function parseProperties(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith('!')) {
      continue;
    }

    // Handle line continuation (backslash at end)
    while (line.endsWith('\\') && i + 1 < lines.length) {
      line = line.slice(0, -1) + lines[++i].trim();
    }

    // Find separator (= or : or space)
    const separatorMatch = line.match(/^([^=:]+?)\s*[=:]\s*(.*)$/);
    if (!separatorMatch) continue;

    const key = separatorMatch[1].trim();
    let value = separatorMatch[2].trim();

    // Unescape Java properties escapes
    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\=/g, '=')
      .replace(/\\:/g, ':')
      .replace(/\\#/g, '#')
      .replace(/\\!/g, '!');

    if (hasTranslatableText(value)) {
      entries.push({ key, value });
    }
  }

  return entries;
}

export function rebuildProperties(original: string, translations: Map<string, string>): string {
  const lines = original.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Keep empty lines and comments as-is
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      result.push(line);
      continue;
    }

    // Handle line continuation
    let fullLine = line;
    while (fullLine.trimEnd().endsWith('\\') && i + 1 < lines.length) {
      fullLine += '\n' + lines[++i];
    }

    // Parse key=value
    const separatorMatch = fullLine.match(/^(\s*)([^=:]+?)\s*([=:])\s*(.*)$/);
    if (!separatorMatch) {
      result.push(fullLine);
      continue;
    }

    const [, indent, key, separator, value] = separatorMatch;
    const trimmedKey = key.trim();

    if (translations.has(trimmedKey)) {
      let translated = translations.get(trimmedKey)!;

      // Escape special characters for properties format
      translated = translated
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/=/g, '\\=')
        .replace(/:/g, '\\:')
        .replace(/#/g, '\\#')
        .replace(/!/g, '\\!');

      result.push(`${indent}${trimmedKey}${separator}${translated}`);
    } else {
      result.push(fullLine);
    }
  }

  return result.join('\n');
}

// ============================================================
// BLOCK: .yml/.yaml parser (YAML format)
// ============================================================
export function parseYaml(content: string): LangEntry[] {
  const entries: LangEntry[] = [];
  const lines = content.split('\n');

  // Simple YAML parser for flat key-value pairs
  // Supports: key: value, "key": "value", 'key': 'value'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines, comments, and complex structures
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('[')) {
      continue;
    }

    // Match key: value pattern
    const match = trimmed.match(/^(['"]?)([^'":\s]+)\1\s*:\s*(['"]?)(.+)\3$/);
    if (!match) continue;

    const key = match[2];
    let value = match[4];

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Unescape common YAML escapes
    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");

    if (hasTranslatableText(value)) {
      entries.push({ key, value });
    }
  }

  return entries;
}

export function rebuildYaml(original: string, translations: Map<string, string>): string {
  const lines = original.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Keep empty lines, comments, and complex structures as-is
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('[')) {
      result.push(line);
      continue;
    }

    // Match key: value pattern
    const match = trimmed.match(/^(['"]?)([^'":\s]+)\1\s*:\s*(['"]?)(.+)\3$/);
    if (!match) {
      result.push(line);
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1] || '';
    const keyQuote = match[1];
    const key = match[2];
    const valueQuote = match[3];

    if (translations.has(key)) {
      let translated = translations.get(key)!;

      // Escape special characters for YAML
      translated = translated
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");

      // Use same quote style as original
      const quote = valueQuote || (translated.includes(':') || translated.includes('#') ? '"' : '');
      result.push(`${indent}${keyQuote}${key}${keyQuote}: ${quote}${translated}${quote}`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// ============================================================
// BLOCK: JAR lang file detection helpers
// ============================================================
export function isTargetLangFile(path: string): boolean {
  return /assets\/[^/]+\/lang\/en[_-]?(us|US)?(\.(json|lang))?$/.test(path) ||
         /assets\/[^/]+\/lang\/en\.(json|lang)$/.test(path);
}

export function detectLangFormat(filename: string): 'json' | 'lang' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.lang')) return 'lang';
  return null;
}
