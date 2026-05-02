import { NextRequest, NextResponse } from 'next/server';
import { countJarStrings } from '@/lib/jarProcessor';
import { analyzeModpack } from '@/lib/modpackProcessor';
import { parseJsonLang, parseDotLang, parseSnbt, parseToml } from '@/lib/langParsers';

export async function POST(req: NextRequest) {
  console.log('\n=== API /api/analyze START ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await req.json() as { base64: string; fileName: string };
    console.log('Request body keys:', Object.keys(body));
    console.log('fileName:', body.fileName);
    console.log('base64 length:', body.base64?.length || 0);

    const { base64, fileName } = body;
    const buffer = Buffer.from(base64, 'base64');
    console.log('Buffer size:', buffer.length, 'bytes');

    const ext = fileName.split('.').pop()?.toLowerCase();
    console.log('Detected extension:', ext);

    // ── ZIP modpack ────────────────────────────────────────────
    if (ext === 'zip') {
      console.log('Processing as ZIP modpack...');
      const stats = await analyzeModpack(buffer);
      console.log('Modpack stats:', stats);
      const response = {
        stringsCount: stats.totalStrings,
        langFilesCount: stats.translatableFiles,
        mode: 'modpack',
      };
      console.log('Response:', response);
      console.log('=== API /api/analyze END (ZIP) ===\n');
      return NextResponse.json(response);
    }

    // ── JAR mod ────────────────────────────────────────────────
    if (ext === 'jar') {
      console.log('Processing as JAR mod...');
      const stats = await countJarStrings(buffer);
      console.log('JAR stats:', stats);
      const response = { ...stats, mode: 'jar' };
      console.log('Response:', response);
      console.log('=== API /api/analyze END (JAR) ===\n');
      return NextResponse.json(response);
    }

    // ── Standalone files ───────────────────────────────────────
    console.log('Processing as standalone file...');
    const content = buffer.toString('utf-8');
    console.log('Content length:', content.length, 'chars');
    let count = 0;

    if (ext === 'json') {
      console.log('Parsing as JSON...');
      try {
        const entries = parseJsonLang(content);
        count = entries.length;
        console.log('JSON entries found:', count);
      } catch (err) {
        console.error('JSON parse error:', err);
        count = 0;
      }
    }
    if (ext === 'lang') {
      console.log('Parsing as .lang...');
      count = parseDotLang(content).length;
      console.log('.lang entries found:', count);
    }
    if (ext === 'snbt') {
      console.log('Parsing as SNBT...');
      count = parseSnbt(content).length;
      console.log('SNBT entries found:', count);
    }
    if (ext === 'toml') {
      console.log('Parsing as TOML...');
      count = parseToml(content).length;
      console.log('TOML entries found:', count);
    }

    const response = { stringsCount: count, langFilesCount: 1, mode: 'file' };
    console.log('Response:', response);
    console.log('=== API /api/analyze END (standalone) ===\n');
    return NextResponse.json(response);

  } catch (err) {
    console.error('=== API /api/analyze ERROR ===');
    console.error('Error:', err);
    console.error('Error stack:', err instanceof Error ? err.stack : 'no stack');
    console.log('=== API /api/analyze END (error) ===\n');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
