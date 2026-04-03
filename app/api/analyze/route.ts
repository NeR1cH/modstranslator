import { NextRequest, NextResponse } from 'next/server';
import { countJarStrings } from '@/lib/jarProcessor';
import { analyzeModpack } from '@/lib/modpackProcessor';
import { parseJsonLang, parseDotLang, parseSnbt, parseToml } from '@/lib/langParsers';

export async function POST(req: NextRequest) {
  try {
    const { base64, fileName } = await req.json() as { base64: string; fileName: string };
    const buffer = Buffer.from(base64, 'base64');
    const ext    = fileName.split('.').pop()?.toLowerCase();

    // ── ZIP modpack ────────────────────────────────────────────
    if (ext === 'zip') {
      const stats = await analyzeModpack(buffer);
      return NextResponse.json({
        stringsCount: stats.totalStrings,
        langFilesCount: stats.translatableFiles,
        mode: 'modpack',
      });
    }

    // ── JAR mod ────────────────────────────────────────────────
    if (ext === 'jar') {
      const stats = await countJarStrings(buffer);
      return NextResponse.json({ ...stats, mode: 'jar' });
    }

    // ── Standalone files ───────────────────────────────────────
    const content = buffer.toString('utf-8');
    let count = 0;

    if (ext === 'json')  { try { count = parseJsonLang(content).length; } catch { count = 0; } }
    if (ext === 'lang')  { count = parseDotLang(content).length; }
    if (ext === 'snbt')  { count = parseSnbt(content).length; }
    if (ext === 'toml')  { count = parseToml(content).length; }

    return NextResponse.json({ stringsCount: count, langFilesCount: 1, mode: 'file' });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
