import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import JSZip from 'jszip';
import { translateModpackFromBuffer } from '@/lib/modpackProcessor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Process uploaded file from disk
 * Translates the file and returns the result
 */
export async function POST(request: NextRequest) {
  console.log('[process-upload] Request received');

  let tempPath: string = '';

  try {
    const body = await request.json();
    const { tempPath: path, fileName, format } = body;

    if (!path || !fileName || !format) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    tempPath = path;
    console.log('[process-upload] Processing file:', fileName);

    // Read file from disk
    const buffer = await readFile(tempPath);
    console.log('[process-upload] File loaded, size:', buffer.length);

    // Process based on format
    let resultBuffer: Buffer;
    let outputFileName: string;

    if (format === 'zip') {
      // Process modpack
      console.log('[process-upload] Processing as modpack');
      const result = await translateModpackFromBuffer(buffer, fileName);
      resultBuffer = result.buffer;
      outputFileName = result.fileName;
    } else if (format === 'jar') {
      // Process single JAR
      console.log('[process-upload] Processing as JAR');
      // TODO: Implement JAR processing from buffer
      throw new Error('JAR processing not yet implemented for streaming');
    } else {
      throw new Error('Unsupported format');
    }

    // Clean up temp file
    await unlink(tempPath);
    console.log('[process-upload] Temp file deleted');

    // Return result as binary response
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(resultBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        'X-Output-Filename': outputFileName,
      },
    });

  } catch (error) {
    console.error('[process-upload] Error:', error);

    // Clean up temp file on error
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch (e) {
        console.error('[process-upload] Failed to delete temp file:', e);
      }
    }

    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
