import { NextResponse } from 'next/server';
import { getFragmentCache } from '@/lib/fragmentCache';

export async function GET() {
  try {
    const fragmentCache = getFragmentCache();
    const stats = fragmentCache.getStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[fragment-stats] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get fragment cache stats' },
      { status: 500 }
    );
  }
}
