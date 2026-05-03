import { NextResponse } from 'next/server';
import { getRateLimiter } from '@/lib/rateLimiter';

// ============================================================
// BLOCK: GET usage statistics
// ============================================================
export async function GET() {
  try {
    const rateLimiter = getRateLimiter();
    const stats = rateLimiter.getUsageStats();

    const remaining = stats.monthlyLimit - stats.charactersUsed;
    const usagePercent = (stats.charactersUsed / stats.monthlyLimit) * 100;

    return NextResponse.json({
      ...stats,
      remaining,
      usagePercent: Math.round(usagePercent * 10) / 10, // Round to 1 decimal
    });
  } catch (error) {
    console.error('[api/usage] Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
