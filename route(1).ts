import { NextRequest, NextResponse } from 'next/server';
import { countJarStrings, extractLangFiles } from '@/lib/jarProcessor';
import { parseJsonLang, parseDotLang } from '@/lib/langParsers';

// ============================================================
// BLOCK: POST /api/analyze
// Receives a file as base64, returns stats without translating
// Used to populate the file queue with string counts
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { base64, fileName } = await req.json() as {
      base64: string;
      fileName: string;
    };

    const buffer = Buffer.from(base64, 'base64');
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'jar') {
      const stats = await countJarStrings(buffer);
      return NextResponse.json(stats);
    }

    if (ext === 'json') {
      const content = buffer.toString('utf-8');
      const entries = parseJsonLang(content);
      return NextResponse.json({ stringsCount: entries.length, langFilesCount: 1 });
    }

    if (ext === 'lang') {
      const content = buffer.toString('utf-8');
      const entries = parseDotLang(content);
      return NextResponse.json({ stringsCount: entries.length, langFilesCount: 1 });
    }

    return NextResponse.json({ stringsCount: 0, langFilesCount: 0 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
