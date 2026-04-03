import { NextRequest, NextResponse } from 'next/server';
import { extractLangFiles, translateLangFiles, repackJar } from '@/lib/jarProcessor';
import { translateModpack } from '@/lib/modpackProcessor';
import {
  parseJsonLang, parseDotLang, parseSnbt, parseToml, parseCfg,
  parseNestedJson, parseXml, parsePlainText,
  rebuildJsonLang, rebuildDotLang, rebuildSnbt, rebuildToml, rebuildCfg,
  rebuildNestedJson, rebuildXml, rebuildPlainText,
} from '@/lib/langParsers';
import { translateTexts } from '@/lib/deepl';
import { LangEntry } from '@/types';

// ============================================================
// BLOCK: Route handler — dispatches by file format
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { base64, fileName } = await req.json() as { base64: string; fileName: string };
    const buffer = Buffer.from(base64, 'base64');
    const ext    = fileName.split('.').pop()?.toLowerCase();

    // ── ZIP modpack (full automatic translation) ───────────────
    if (ext === 'zip') {
      const resultBuffer = await translateModpack(buffer);
      return NextResponse.json({
        resultBase64: resultBuffer.toString('base64'),
        translatedCount: -1, // counted inside
        langFilesCount: -1,
        outputFileName: fileName.replace('.zip', '_RU.zip'),
      });
    }

    // ── JAR mod ────────────────────────────────────────────────
    if (ext === 'jar') {
      const langFiles    = await extractLangFiles(buffer);
      if (!langFiles.length) throw new Error('Нет английских lang файлов в JAR');
      const translations = await translateLangFiles(langFiles);
      const resultBuffer = await repackJar(buffer, translations);
      const totalStrings = langFiles.reduce((s, f) => s + f.entries.length, 0);
      return NextResponse.json({
        resultBase64: resultBuffer.toString('base64'),
        translatedCount: totalStrings,
        langFilesCount: langFiles.length,
        outputFileName: fileName,
      });
    }

    // ── Standalone file handlers ───────────────────────────────
    const content = buffer.toString('utf-8');
    const { entries, rebuild, outName } = await getStandaloneHandler(ext!, content, fileName);

    if (!entries.length) throw new Error('Нет строк для перевода');

    const values     = entries.map(e => e.value);
    const translated = await translateTexts(values);
    const transMap   = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));
    const result     = rebuild(content, transMap);

    return NextResponse.json({
      resultBase64: Buffer.from(result, 'utf-8').toString('base64'),
      translatedCount: entries.length,
      langFilesCount: 1,
      outputFileName: outName,
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ============================================================
// BLOCK: Standalone file format router
// ============================================================
async function getStandaloneHandler(ext: string, content: string, fileName: string) {
  const ruName = fileName
    .replace(/en[_-]?(us|US)?\.json$/i, 'ru_ru.json')
    .replace(/en[_-]?(us|US)?\.lang$/i, 'ru_ru.lang')
    .replace(/en\.json$/i, 'ru_ru.json');

  switch (ext) {
    case 'json': {
      // Try flat lang first, fall back to nested
      let entries: LangEntry[];
      try { entries = parseJsonLang(content); } catch { entries = []; }
      if (!entries.length) entries = parseNestedJson(content);
      return {
        entries,
        rebuild: entries.length ? rebuildJsonLang : rebuildNestedJson,
        outName: ruName,
      };
    }
    case 'lang':  return { entries: parseDotLang(content),    rebuild: rebuildDotLang,    outName: ruName };
    case 'snbt':  return { entries: parseSnbt(content),       rebuild: rebuildSnbt,       outName: fileName };
    case 'toml':  return { entries: parseToml(content),       rebuild: rebuildToml,       outName: fileName };
    case 'cfg':   return { entries: parseCfg(content),        rebuild: rebuildCfg,        outName: fileName };
    case 'xml':   return { entries: parseXml(content),        rebuild: rebuildXml,        outName: fileName };
    case 'txt':   return { entries: parsePlainText(content),  rebuild: rebuildPlainText,  outName: fileName };
    default:      return { entries: [],                       rebuild: () => content,     outName: fileName };
  }
}
