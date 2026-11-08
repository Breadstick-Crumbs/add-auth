// Next.js 16+: this file is proxy.ts and exports `proxy`.
// Next.js 15 and earlier: name it middleware.ts and rename the export to `middleware`.
//
// A fast first gate: sends visitors without a valid session cookie away from
// protected paths. Pages and actions must still call getUser()/requireUser(),
// because this only checks the token, not whether the user still exists.
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readAccessToken } from '@/lib/auth/core';

const PROTECTED = ['/account', '/dashboard', '/settings', '/admin'];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const userId = await readAccessToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();
  const url = new URL('/sign-in', request.url);
  url.searchParams.set('next', pathname + search);
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
