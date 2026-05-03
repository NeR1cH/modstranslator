import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting
// For production, consider using Redis or a dedicated rate limiting service
const requestCache = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = requestCache.get(ip) || [];

  // Remove requests older than 1 minute
  const recentRequests = requests.filter(time => now - time < 60000);

  // Allow 20 requests per minute per IP
  if (recentRequests.length >= 20) {
    return false;
  }

  recentRequests.push(now);
  requestCache.set(ip, recentRequests);

  // Cleanup: remove old IPs to prevent memory leak
  if (requestCache.size > 1000) {
    const oldestIp = requestCache.keys().next().value;
    if (oldestIp) {
      requestCache.delete(oldestIp);
    }
  }

  return true;
}

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // CSRF protection for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Allow requests from same origin
    if (!origin || !host || !origin.includes(host)) {
      console.warn('[middleware] CSRF check failed:', { origin, host });
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }
  }

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';

  if (!checkRateLimit(ip)) {
    console.warn('[middleware] Rate limit exceeded for IP:', ip);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
