import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// ============================================================
// BLOCK: POST /api/export
// Receives array of { outputFileName, resultBase64 }
// Packs them into a single ZIP archive for download
// ============================================================
export async function POST(req: NextRequest) {
  console.log('\n=== API /api/export START ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await req.json() as {
      files: Array<{ outputFileName: string; resultBase64: string }>;
    };
    console.log('Request body keys:', Object.keys(body));

    const { files } = body;
    console.log('Files to export:', files.length);

    files.forEach((file, idx) => {
      console.log(`File ${idx + 1}:`, {
        outputFileName: file.outputFileName,
        resultBase64Length: file.resultBase64?.length || 0,
      });
    });

    console.log('Creating ZIP archive...');
    const zip = new JSZip();
    const folder = zip.folder('translated_mods');
    console.log('Folder created:', folder ? 'yes' : 'no');

    for (const file of files) {
      console.log('Adding file to ZIP:', file.outputFileName);
      const buffer = Buffer.from(file.resultBase64, 'base64');
      console.log('  Buffer size:', buffer.length, 'bytes');
      folder?.file(file.outputFileName, buffer);
    }

    console.log('Generating ZIP buffer...');
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    console.log('ZIP buffer generated, size:', zipBuffer.length, 'bytes');

    console.log('Sending response...');
    console.log('=== API /api/export END ===\n');
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="translated_mods.zip"',
      },
    });
  } catch (err) {
    console.error('=== API /api/export ERROR ===');
    console.error('Error:', err);
    console.error('Error stack:', err instanceof Error ? err.stack : 'no stack');
    console.log('=== API /api/export END (error) ===\n');
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
