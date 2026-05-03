import JSZip from 'jszip';
import {
  parseJsonLang, parseDotLang, parseSnbt, parseToml,
  parseCfg, parseNestedJson, parseXml, parsePlainText,
  rebuildJsonLang, rebuildDotLang, rebuildSnbt, rebuildToml,
  rebuildCfg, rebuildNestedJson, rebuildXml, rebuildPlainText,
  isTargetLangFile, detectFormat, hasTranslatableText,
} from './langParsers';
import { translateTexts } from './deepl';
import { LangEntry } from '@/types';
import { sanitizePath } from './security';

// ============================================================
// BLOCK: File category detection
// Decides how to parse each file in the modpack
// ============================================================

/** Files/paths to always skip */
const SKIP_PATTERNS = [
  /node_modules/, /\.git/, /\.(png|jpg|jpeg|gif|webp|ico|svg)$/i,
  /\.(mp3|ogg|wav|mp4|avi)$/i, /\.(class|jar|zip|tar|gz)$/i,
  /\.(exe|dll|so|dylib)$/i, /META-INF/i,
];

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(path));
}

/** Determine parse strategy for a file path */
function getStrategy(path: string): string | null {
  if (shouldSkip(path)) return null;

  const lower = path.toLowerCase();

  // JAR lang files (en_us)
  if (isTargetLangFile(path)) return 'lang_json_or_lang';

  // FTB Quests / Better Questing
  if (lower.endsWith('.snbt')) return 'snbt';

  // Forge configs with text
  if (lower.endsWith('.toml')) return 'toml';
  if (lower.endsWith('.cfg'))  return 'cfg';

  // Patchouli books, custom quests, dialogues — nested JSON
  if (lower.endsWith('.json') && (
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
  )) return 'nested_json';

  // Plain lang JSON (flat key:value)
  if (lower.endsWith('.json') && lower.includes('/lang/')) return 'lang_json';

  // XML dialogues/subtitles
  if (lower.endsWith('.xml') && (
    lower.includes('dialogue') || lower.includes('subtitle') ||
    lower.includes('cutscene') || lower.includes('lang')
  )) return 'xml';

  // Plain text subtitle/script files
  if (lower.endsWith('.txt') && (
    lower.includes('subtitle') || lower.includes('script') ||
    lower.includes('dialogue') || lower.includes('cutscene')
  )) return 'txt';

  return null;
}

// ============================================================
// BLOCK: Shared entry extraction (single source of truth)
// ============================================================

/** Parse file content into LangEntry[] based on strategy. Returns [] on error. */
function extractEntries(path: string, content: string, strategy: string): LangEntry[] {
  try {
    switch (strategy) {
      case 'lang_json_or_lang':
        return path.endsWith('.json') ? parseJsonLang(content) : parseDotLang(content);
      case 'lang_json':    return parseJsonLang(content);
      case 'snbt':         return parseSnbt(content);
      case 'toml':         return parseToml(content);
      case 'cfg':          return parseCfg(content);
      case 'nested_json':  return parseNestedJson(content);
      case 'xml':          return parseXml(content);
      case 'txt':          return parsePlainText(content);
      default:             return [];
    }
  } catch {
    return [];
  }
}

// ============================================================
// BLOCK: Single file translation
// ============================================================
export interface TranslatedFile {
  path: string;
  content: string;
  stringsCount: number;
}

async function translateSingleFile(
  path: string,
  content: string,
  strategy: string
): Promise<TranslatedFile | null> {
  console.log('[modpackProcessor] translateSingleFile:', path);
  console.log('[modpackProcessor]   Strategy:', strategy);

  const entries = extractEntries(path, content, strategy);
  console.log('[modpackProcessor]   Entries extracted:', entries.length);

  if (entries.length === 0) {
    console.log('[modpackProcessor]   No entries, returning null');
    return null;
  }

  const values = entries.map(e => e.value);
  console.log('[modpackProcessor]   Calling translateTexts for', values.length, 'values');

  const translated = await translateTexts(values);
  console.log('[modpackProcessor]   Translation complete, received:', translated.length);

  const transMap = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));
  console.log('[modpackProcessor]   Translation map size:', transMap.size);

  let newContent = content;
  console.log('[modpackProcessor]   Rebuilding content...');

  switch (strategy) {
    case 'lang_json_or_lang':
    case 'lang_json':
      newContent = path.endsWith('.json')
        ? rebuildJsonLang(content, transMap)
        : rebuildDotLang(content, transMap);
      break;
    case 'snbt':        newContent = rebuildSnbt(content, transMap);       break;
    case 'toml':        newContent = rebuildToml(content, transMap);       break;
    case 'cfg':         newContent = rebuildCfg(content, transMap);        break;
    case 'nested_json': newContent = rebuildNestedJson(content, transMap); break;
    case 'xml':         newContent = rebuildXml(content, transMap);        break;
    case 'txt':         newContent = rebuildPlainText(content, transMap);  break;
  }

  console.log('[modpackProcessor]   New content length:', newContent.length, 'chars');

  return { path, content: newContent, stringsCount: entries.length };
}

// ============================================================
// BLOCK: Russian path generator
// en_us.json → ru_ru.json, keeps all other files at same path
// ============================================================
function getRuPath(originalPath: string): string {
  return originalPath
    .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
    .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
    .replace(/en\.json$/i, 'ru_ru.json')
    .replace(/en\.lang$/i, 'ru_ru.lang');
}

// ============================================================
// BLOCK: ZIP/folder modpack processor
// Scans every file, translates what it can, repacks as ZIP
// ============================================================
export interface ModpackStats {
  totalFiles: number;
  translatableFiles: number;
  totalStrings: number;
}

export async function analyzeModpack(zipBuffer: Buffer): Promise<ModpackStats> {
  console.log('\n[modpackProcessor] analyzeModpack called');
  console.log('[modpackProcessor] ZIP buffer size:', zipBuffer.length, 'bytes');

  const zip = await JSZip.loadAsync(zipBuffer);
  console.log('[modpackProcessor] ZIP loaded');

  let translatableFiles = 0;
  let totalStrings = 0;
  let totalFiles = 0;

  const allFiles = Object.entries(zip.files);
  console.log('[modpackProcessor] Total entries in ZIP:', allFiles.length);

  for (const [path, file] of allFiles) {
    if (file.dir) continue;
    totalFiles++;

    const strategy = getStrategy(path);
    if (!strategy) continue;

    console.log('[modpackProcessor] Analyzing:', path, '| strategy:', strategy);

    try {
      const content = await file.async('string');
      const entries = extractEntries(path, content, strategy);

      if (entries.length > 0) {
        translatableFiles++;
        totalStrings += entries.length;
        console.log('[modpackProcessor]   → Found', entries.length, 'translatable strings');
      }
    } catch (err) {
      console.error('[modpackProcessor]   → Error analyzing:', err);
      /* skip malformed files */
    }
  }

  const result = { totalFiles, translatableFiles, totalStrings };
  console.log('[modpackProcessor] Analysis complete:', result);
  return result;
}

export async function translateModpack(
  zipBuffer: Buffer,
  onProgress?: (done: number, total: number, currentFile: string) => void
): Promise<Buffer> {
  console.log('\n[modpackProcessor] translateModpack called');
  console.log('[modpackProcessor] ZIP buffer size:', zipBuffer.length, 'bytes');

  const zip    = await JSZip.loadAsync(zipBuffer);
  const result = await JSZip.loadAsync(zipBuffer); // start with copy of original
  console.log('[modpackProcessor] ZIP loaded, creating result copy');

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  console.log('[modpackProcessor] Total files to process:', entries.length);

  let done = 0;

  for (const [path, file] of entries) {
    const strategy = getStrategy(path);
    if (!strategy) {
      done++;
      continue;
    }

    console.log(`[modpackProcessor] [${done + 1}/${entries.length}] Processing:`, path);
    console.log('[modpackProcessor]   Strategy:', strategy);

    onProgress?.(done, entries.length, path);

    try {
      const content = await file.async('string');
      console.log('[modpackProcessor]   Content length:', content.length, 'chars');

      const translated = await translateSingleFile(path, content, strategy);

      if (translated) {
        console.log('[modpackProcessor]   Translated:', translated.stringsCount, 'strings');
        const ruPath = getRuPath(path);
        console.log('[modpackProcessor]   Output path:', ruPath);

        // Sanitize paths to prevent path traversal attacks
        try {
          const safePath = sanitizePath(ruPath !== path ? ruPath : path);

          if (ruPath !== path) {
            // For lang files: add ru_ru version, keep original
            result.file(safePath, translated.content);
            console.log('[modpackProcessor]   Added as new file (lang)');
          } else {
            // For quests/configs: overwrite in place
            result.file(safePath, translated.content);
            console.log('[modpackProcessor]   Overwritten in place');
          }
        } catch (error) {
          console.error('[modpackProcessor]   Invalid path detected:', ruPath, error);
          // Skip this file if path is invalid
        }
      } else {
        console.log('[modpackProcessor]   No translation needed');
      }
    } catch (err) {
      console.error('[modpackProcessor]   Error:', err);
      /* skip on error */
    }

    done++;
    onProgress?.(done, entries.length, path);
  }

  console.log('[modpackProcessor] Generating result ZIP...');
  const resultBuffer = await result.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  console.log('[modpackProcessor] Result ZIP size:', resultBuffer.length, 'bytes');
  return resultBuffer;
}