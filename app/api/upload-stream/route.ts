import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum file size: 1.5 GB
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024;

/**
 * Streaming file upload endpoint
 * Accepts large files (up to 1.5GB) and saves them to disk for processing
 */
export async function POST(request: NextRequest) {
  console.log('[upload-stream] Request received');

  try {
    // Get file from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('[upload-stream] File received:', file.name, 'Size:', file.size);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 1.5 GB` },
        { status: 413 }
      );
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jar', 'zip'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Only .jar and .zip files are supported' },
        { status: 400 }
      );
    }

    // Generate temporary file path
    const tempId = randomBytes(16).toString('hex');
    const tempPath = join(tmpdir(), `modtranslator-${tempId}.${ext}`);

    console.log('[upload-stream] Saving to temp file:', tempPath);

    // Convert file to buffer and save to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempPath, buffer);

    console.log('[upload-stream] File saved successfully');

    // Return temp file info for processing
    return NextResponse.json({
      success: true,
      tempId,
      tempPath,
      fileName: file.name,
      fileSize: file.size,
      format: ext,
    });

  } catch (error) {
    console.error('[upload-stream] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
