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
  console.log('\n[jarProcessor] extractLangFiles called');
  console.log('[jarProcessor] JAR buffer size:', jarBuffer.length, 'bytes');

  const zip = await JSZip.loadAsync(jarBuffer);
  console.log('[jarProcessor] ZIP loaded, total files:', Object.keys(zip.files).length);

  const found: ExtractedLangFile[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (!isTargetLangFile(path)) continue;

    console.log('[jarProcessor] Found target lang file:', path);

    const format = detectLangFormat(path);
    if (!format) {
      console.warn('[jarProcessor] Could not detect format for:', path);
      continue;
    }

    console.log('[jarProcessor] Format detected:', format);

    const rawContent = await file.async('string');
    console.log('[jarProcessor] Content length:', rawContent.length, 'chars');

    let entries: LangEntry[] = [];

    try {
      entries = format === 'json'
        ? parseJsonLang(rawContent)
        : parseDotLang(rawContent);
      console.log('[jarProcessor] Parsed entries:', entries.length);
    } catch (err) {
      console.error('[jarProcessor] Parse error for', path, ':', err);
      // Malformed lang file — skip silently
      continue;
    }

    found.push({ path, format, entries, rawContent });
  }

  console.log('[jarProcessor] Total lang files extracted:', found.length);
  return found;
}

// ============================================================
// BLOCK: Translate all lang files from a JAR
// Returns a map: path → translated content string
// ============================================================
export async function translateLangFiles(
  langFiles: ExtractedLangFile[]
): Promise<Map<string, string>> {
  console.log('\n[jarProcessor] translateLangFiles called');
  console.log('[jarProcessor] Lang files to translate:', langFiles.length);

  const result = new Map<string, string>();

  for (let i = 0; i < langFiles.length; i++) {
    const langFile = langFiles[i];
    console.log(`[jarProcessor] Processing file ${i + 1}/${langFiles.length}: ${langFile.path}`);
    console.log('[jarProcessor] Entries count:', langFile.entries.length);

    if (langFile.entries.length === 0) {
      console.log('[jarProcessor] No entries, skipping');
      continue;
    }

    // Extract only values for translation
    const values = langFile.entries.map(e => e.value);
    console.log('[jarProcessor] Calling translateTexts...');
    const translated = await translateTexts(values);
    console.log('[jarProcessor] Translation complete');

    // Build translation map: key → translated value
    const transMap = new Map<string, string>();
    langFile.entries.forEach((entry, i) => {
      transMap.set(entry.key, translated[i] ?? entry.value);
    });

    console.log('[jarProcessor] Translation map size:', transMap.size);

    // Rebuild file content with translations
    console.log('[jarProcessor] Rebuilding file content...');
    const newContent = langFile.format === 'json'
      ? rebuildJsonLang(langFile.rawContent, transMap)
      : rebuildDotLang(langFile.rawContent, transMap);

    console.log('[jarProcessor] New content length:', newContent.length, 'chars');
    result.set(langFile.path, newContent);
  }

  console.log('[jarProcessor] Total translated files:', result.size);
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
  console.log('\n[jarProcessor] repackJar called');
  console.log('[jarProcessor] Original JAR size:', originalJarBuffer.length, 'bytes');
  console.log('[jarProcessor] Translations to add:', translations.size);

  const zip = await JSZip.loadAsync(originalJarBuffer);

  for (const [originalPath, translatedContent] of Array.from(translations.entries())) {
    // Generate Russian locale path: en_us.json → ru_ru.json
    const ruPath = originalPath
      .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
      .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
      .replace(/en\.json$/i, 'ru_ru.json')
      .replace(/en\.lang$/i, 'ru_ru.lang');

    console.log('[jarProcessor] Adding:', originalPath, '→', ruPath);
    zip.file(ruPath, translatedContent);
  }

  console.log('[jarProcessor] Generating new JAR...');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  console.log('[jarProcessor] New JAR size:', buffer.length, 'bytes');
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
  console.log('\n[jarProcessor] countJarStrings called');
  const langFiles = await extractLangFiles(jarBuffer);
  const result = {
    langFilesCount: langFiles.length,
    stringsCount: langFiles.reduce((sum, f) => sum + f.entries.length, 0),
  };
  console.log('[jarProcessor] Count result:', result);
  return result;
}
