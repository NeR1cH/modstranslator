import { NextRequest, NextResponse } from 'next/server';
import { extractLangFiles, translateLangFiles, repackJar } from '@/lib/jarProcessor';
import { parseJsonLang, parseDotLang, rebuildJsonLang, rebuildDotLang } from '@/lib/langParsers';
import { translateTexts } from '@/lib/deepl';

// ============================================================
// BLOCK: POST /api/translate
// Handles JAR, JSON and .lang files
// Returns translated file as base64
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { base64, fileName } = await req.json() as {
      base64: string;
      fileName: string;
    };

    const buffer = Buffer.from(base64, 'base64');
    const ext = fileName.split('.').pop()?.toLowerCase();

    // ── JAR path ──────────────────────────────────────────────
    if (ext === 'jar') {
      const langFiles = await extractLangFiles(buffer);
      if (langFiles.length === 0) {
        return NextResponse.json({ error: 'Нет английских lang файлов в JAR' }, { status: 400 });
      }

      const translations = await translateLangFiles(langFiles);
      const resultBuffer = await repackJar(buffer, translations);

      const totalStrings = langFiles.reduce((s, f) => s + f.entries.length, 0);
      return NextResponse.json({
        resultBase64: resultBuffer.toString('base64'),
        translatedCount: totalStrings,
        langFilesCount: langFiles.length,
        outputFileName: fileName, // same name, ru_ru.json added inside
      });
    }

    // ── Standalone JSON lang path ──────────────────────────────
    if (ext === 'json') {
      const content = buffer.toString('utf-8');
      const entries = parseJsonLang(content);
      const translated = await translateTexts(entries.map(e => e.value));
      const transMap = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));
      const result = rebuildJsonLang(content, transMap);

      return NextResponse.json({
        resultBase64: Buffer.from(result, 'utf-8').toString('base64'),
        translatedCount: entries.length,
        langFilesCount: 1,
        outputFileName: fileName.replace(/en[_-]?us/i, 'ru_ru').replace(/en\./i, 'ru_ru.'),
      });
    }

    // ── Standalone .lang path ──────────────────────────────────
    if (ext === 'lang') {
      const content = buffer.toString('utf-8');
      const entries = parseDotLang(content);
      const translated = await translateTexts(entries.map(e => e.value));
      const transMap = new Map(entries.map((e, i) => [e.key, translated[i] ?? e.value]));
      const result = rebuildDotLang(content, transMap);

      return NextResponse.json({
        resultBase64: Buffer.from(result, 'utf-8').toString('base64'),
        translatedCount: entries.length,
        langFilesCount: 1,
        outputFileName: fileName.replace(/en[_-]?us/i, 'ru_ru').replace(/en\./i, 'ru_ru.'),
      });
    }

    return NextResponse.json({ error: `Неподдерживаемый формат: .${ext}` }, { status: 400 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow large JAR uploads (up to 200 MB)
export const config = {
  api: { bodyParser: { sizeLimit: '200mb' } },
};
