import JSZip from 'jszip';
import {
  parseJsonLang, parseDotLang,
  rebuildJsonLang, rebuildDotLang,
  detectLangFormat, isTargetLangFile,
} from './langParsers';
import { translateTexts } from './deepl';
import { ExtractedLangFile, LangEntry } from '@/types';

// ============================================================
// BLOCK: JAR extraction
// JAR files are ZIP archives — use JSZip to read them
// Returns all English lang files found inside
// ============================================================
export async function extractLangFiles(
  jarBuffer: Buffer
): Promise<ExtractedLangFile[]> {
  const zip = await JSZip.loadAsync(jarBuffer);
  const found: ExtractedLangFile[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (!isTargetLangFile(path)) continue;

    const format = detectLangFormat(path);
    if (!format) continue;

    const rawContent = await file.async('string');
    let entries: LangEntry[] = [];

    try {
      entries = format === 'json'
        ? parseJsonLang(rawContent)
        : parseDotLang(rawContent);
    } catch {
      // Malformed lang file — skip silently
      continue;
    }

    found.push({ path, format, entries, rawContent });
  }

  return found;
}

// ============================================================
// BLOCK: Translate all lang files from a JAR
// Returns a map: path → translated content string
// ============================================================
export async function translateLangFiles(
  langFiles: ExtractedLangFile[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const langFile of langFiles) {
    if (langFile.entries.length === 0) continue;

    // Extract only values for translation
    const values = langFile.entries.map(e => e.value);
    const translated = await translateTexts(values);

    // Build translation map: key → translated value
    const transMap = new Map<string, string>();
    langFile.entries.forEach((entry, i) => {
      transMap.set(entry.key, translated[i] ?? entry.value);
    });

    // Rebuild file content with translations
    const newContent = langFile.format === 'json'
      ? rebuildJsonLang(langFile.rawContent, transMap)
      : rebuildDotLang(langFile.rawContent, transMap);

    result.set(langFile.path, newContent);
  }

  return result;
}

// ============================================================
// BLOCK: Repack JAR with translated ru_ru lang files
// Strategy:
//   - Copy ALL original files unchanged
//   - For each translated en_us.json/lang → also write ru_ru.json/lang
//   - Return modified JAR as Buffer
// ============================================================
export async function repackJar(
  originalJarBuffer: Buffer,
  translations: Map<string, string>
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(originalJarBuffer);

  for (const [originalPath, translatedContent] of Array.from(translations.entries())) {
    // Generate Russian locale path: en_us.json → ru_ru.json
    const ruPath = originalPath
      .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
      .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
      .replace(/en\.json$/i, 'ru_ru.json')
      .replace(/en\.lang$/i, 'ru_ru.lang');

    zip.file(ruPath, translatedContent);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}

// ============================================================
// BLOCK: Count total translatable strings in a JAR
// Used for preview before translation starts
// ============================================================
export async function countJarStrings(jarBuffer: Buffer): Promise<{
  langFilesCount: number;
  stringsCount: number;
}> {
  const langFiles = await extractLangFiles(jarBuffer);
  return {
    langFilesCount: langFiles.length,
    stringsCount: langFiles.reduce((sum, f) => sum + f.entries.length, 0),
  };
}
