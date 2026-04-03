import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// ============================================================
// BLOCK: POST /api/export
// Receives array of { outputFileName, resultBase64 }
// Packs them into a single ZIP archive for download
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { files } = await req.json() as {
      files: Array<{ outputFileName: string; resultBase64: string }>;
    };

    const zip = new JSZip();
    const folder = zip.folder('translated_mods');

    for (const file of files) {
      const buffer = Buffer.from(file.resultBase64, 'base64');
      folder?.file(file.outputFileName, buffer);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="translated_mods.zip"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
