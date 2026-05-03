import { NextResponse } from 'next/server';
import { getTranslationCache } from '@/lib/translationCache';
import { getFragmentCache } from '@/lib/fragmentCache';

// ============================================================
// BLOCK: GET cache statistics
// ============================================================
export async function GET() {
  try {
    const cache = getTranslationCache();
    const fragmentCache = getFragmentCache();
    const stats = cache.getStats();
    const fragmentStats = fragmentCache.getStats();

    return NextResponse.json({
      ...stats,
      fragments: fragmentStats
    });
  } catch (error) {
    console.error('[api/cache-stats] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// BLOCK: DELETE - clear cache
// ============================================================
export async function DELETE() {
  try {
    const cache = getTranslationCache();
    const fragmentCache = getFragmentCache();
    cache.clear();
    fragmentCache.flush();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('[api/cache-stats] Error clearing cache:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
