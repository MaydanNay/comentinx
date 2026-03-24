import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getFromCache, setToCache } from './lib/cache';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate limit the polling endpoint
  if (pathname.includes('/api/games/') && pathname.endsWith('/poll')) {
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const key = `rate-limit-${ip}-${pathname}`;
    
    const lastRequest = getFromCache<number>(key);
    const now = Date.now();

    // Limit to 1 request per 1.5 seconds per IP
    if (lastRequest && now - lastRequest < 1500) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    setToCache(key, now, 2);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/games/:id/poll',
};
