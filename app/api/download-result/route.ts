import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Download translated file from disk
 * Automatically deletes the file after successful download
 */
export async function GET(request: NextRequest) {
  console.log('[download-result] Request received');

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }

    // Sanitize fileId to prevent path traversal
    if (!/^[a-f0-9]{32}$/.test(fileId)) {
      return NextResponse.json(
        { error: 'Invalid file ID' },
        { status: 400 }
      );
    }

    const resultPath = join(tmpdir(), `modtranslator-result-${fileId}.zip`);
    const metaPath = join(tmpdir(), `modtranslator-result-${fileId}.json`);

    console.log('[download-result] Result path:', resultPath);

    // Check if file exists
    try {
      await stat(resultPath);
    } catch {
      return NextResponse.json(
        { error: 'File not found or expired' },
        { status: 404 }
      );
    }

    // Read metadata
    let outputFileName = 'translated.zip';
    try {
      const metaContent = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      outputFileName = meta.outputFileName || outputFileName;
    } catch (err) {
      console.warn('[download-result] Could not read metadata:', err);
    }

    // Read file
    const buffer = await readFile(resultPath);
    console.log('[download-result] File loaded, size:', buffer.length);

    // Delete files after reading (cleanup)
    try {
      await unlink(resultPath);
      await unlink(metaPath);
      console.log('[download-result] Temp files deleted');
    } catch (err) {
      console.warn('[download-result] Could not delete temp files:', err);
    }

    // Return file
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[download-result] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
