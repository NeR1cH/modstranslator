import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import JSZip from 'jszip';
import { translateModpackFromBuffer } from '@/lib/modpackProcessor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Process uploaded file from disk
 * Translates the file and saves result to disk, returns download ID
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

    // Save result to disk with unique ID
    const resultId = randomBytes(16).toString('hex');
    const resultPath = join(tmpdir(), `modtranslator-result-${resultId}.zip`);
    const metaPath = join(tmpdir(), `modtranslator-result-${resultId}.json`);

    await writeFile(resultPath, resultBuffer);
    await writeFile(metaPath, JSON.stringify({ outputFileName, createdAt: Date.now() }));

    console.log('[process-upload] Result saved to disk:', resultPath);

    // Return download ID
    return NextResponse.json({
      success: true,
      resultId,
      outputFileName,
      fileSize: resultBuffer.length,
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
