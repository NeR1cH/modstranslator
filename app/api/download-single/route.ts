import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// BLOCK: POST /api/download-single
// Downloads a single translated file
// ============================================================
export async function POST(req: NextRequest) {
  console.log('\n=== API /api/download-single START ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const body = await req.json() as {
      outputFileName: string;
      resultBase64: string;
    };

    console.log('File to download:', body.outputFileName);
    console.log('Base64 length:', body.resultBase64?.length || 0);

    const buffer = Buffer.from(body.resultBase64, 'base64');
    console.log('Buffer size:', buffer.length, 'bytes');

    // Determine content type based on file extension
    const ext = body.outputFileName.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case 'jar':
        contentType = 'application/java-archive';
        break;
      case 'zip':
        contentType = 'application/zip';
        break;
      case 'json':
        contentType = 'application/json';
        break;
      case 'txt':
      case 'lang':
        contentType = 'text/plain';
        break;
      case 'xml':
        contentType = 'application/xml';
        break;
      case 'toml':
      case 'cfg':
      case 'snbt':
        contentType = 'text/plain';
        break;
    }

    console.log('Content-Type:', contentType);
    console.log('=== API /api/download-single END ===\n');

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${body.outputFileName}"`,
      },
    });
  } catch (err) {
    console.error('=== API /api/download-single ERROR ===');
    console.error('Error:', err);
    console.error('Error stack:', err instanceof Error ? err.stack : 'no stack');
    console.log('=== API /api/download-single END (error) ===\n');
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
