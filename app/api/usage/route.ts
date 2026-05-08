import { NextResponse } from 'next/server';
import { getRateLimiter } from '@/lib/rateLimiter';

// ============================================================
// BLOCK: GET usage statistics (multi-key support)
// ============================================================
export async function GET() {
  try {
    const rateLimiter = getRateLimiter();
    const stats = rateLimiter.getUsageStats();

    // Calculate stats for each key
    const keyStats = Object.entries(stats.keys).map(([key, data]) => {
      const remaining = data.monthlyLimit - data.charactersUsed;
      const usagePercent = (data.charactersUsed / data.monthlyLimit) * 100;

      return {
        key: maskKey(key),
        charactersUsed: data.charactersUsed,
        requestsCount: data.requestsCount,
        monthlyLimit: data.monthlyLimit,
        remaining,
        usagePercent: Math.round(usagePercent * 10) / 10,
        status: data.status,
        lastReset: data.lastReset,
        isCurrent: key === rateLimiter.getCurrentKey()
      };
    });

    // Calculate total stats
    const totalUsed = Object.values(stats.keys).reduce((sum, k) => sum + k.charactersUsed, 0);
    const totalLimit = Object.values(stats.keys).reduce((sum, k) => sum + k.monthlyLimit, 0);
    const totalRemaining = totalLimit - totalUsed;
    const totalPercent = (totalUsed / totalLimit) * 100;

    return NextResponse.json({
      keys: keyStats,
      currentKeyIndex: stats.currentKeyIndex,
      total: {
        charactersUsed: totalUsed,
        monthlyLimit: totalLimit,
        remaining: totalRemaining,
        usagePercent: Math.round(totalPercent * 10) / 10
      }
    });
  } catch (error) {
    console.error('[api/usage] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// Mask API key for security
function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 4);
}
