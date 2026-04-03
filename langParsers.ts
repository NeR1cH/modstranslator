import { LangEntry } from '@/types';

// ============================================================
// BLOCK: JSON lang parser (Minecraft 1.13+)
// Format: { "key": "value", ... }
// Only translates string values, skips objects/arrays
// ============================================================
export function parseJsonLang(content: string): LangEntry[] {
  const obj = JSON.parse(content) as Record<string, unknown>;
  const entries: LangEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.trim() && hasTranslatableText(value)) {
      entries.push({ key, value });
    }
  }

  return entries;
}

export function rebuildJsonLang(
  original: string,
  translations: Map<string, string>
): string {
  const obj = JSON.parse(original) as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && translations.has(key)) {
      obj[key] = translations.get(key);
    }
  }

  return JSON.stringify(obj, null, 2);
}

// ============================================================
// BLOCK: .lang parser (Minecraft pre-1.13)
// Format: key=value per line, # for comments
// ============================================================
export function parseDotLang(content: string): LangEntry[] {
  const entries: LangEntry[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1); // keep trailing spaces intentionally

    if (value.trim() && hasTranslatableText(value)) {
      entries.push({ key, value });
    }
  }

  return entries;
}

export function rebuildDotLang(
  original: string,
  translations: Map<string, string>
): string {
  return original
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return line;

      const key = trimmed.substring(0, eqIdx).trim();
      return translations.has(key)
        ? `${key}=${translations.get(key)}`
        : line;
    })
    .join('\n');
}

// ============================================================
// BLOCK: Helpers
// ============================================================

/** Returns true if the string contains Latin characters worth translating */
function hasTranslatableText(s: string): boolean {
  // Must have at least one Latin letter
  return /[a-zA-Z]/.test(s);
}

/** Detect format from filename */
export function detectLangFormat(filename: string): 'json' | 'lang' | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.lang')) return 'lang';
  return null;
}

/** True if the path inside a JAR is a lang file we should translate */
export function isTargetLangFile(path: string): boolean {
  // Match: assets/<anything>/lang/en_us.json  or  assets/<anything>/lang/en_US.lang
  return /assets\/[^/]+\/lang\/en[_-]?(us|US)?(\.(json|lang))?$/.test(path) ||
         /assets\/[^/]+\/lang\/en\.(json|lang)$/.test(path);
}
