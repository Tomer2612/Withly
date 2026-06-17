import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
  '/settings',
  '/communities', // Community pages need auth (except preview)
];

// Routes that are always public
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/terms',
  '/privacy',
  '/pricing',
  '/contact',
  '/support',
  '/google-success',
];

// Routes that are public within protected paths
const publicExceptions = [
  '/preview', // /communities/[id]/preview is public
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read the httpOnly access cookie set by the backend on login/refresh.
  // Middleware runs server-side so it CAN read httpOnly cookies — that's
  // why this works without client-side mirroring.
  const token = request.cookies.get('access_token')?.value;

  // Validate token expiry by decoding the JWT payload (no signature check
  // here — the backend verifies on every request; middleware only gates
  // routing and treats a syntactically-broken or expired token as absent).
  let isTokenValid = false;
  if (token) {
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(atob(payloadBase64));
        isTokenValid = payload.exp && payload.exp * 1000 > Date.now();
      }
    } catch {
      isTokenValid = false;
    }
  }

  const effectiveToken = isTokenValid ? token : undefined;
  
  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  // Check for public exceptions (like /preview pages)
  const hasPublicException = publicExceptions.some(exception => 
    pathname.includes(exception)
  );
  
  // Redirect logged-in users away from login/signup
  if (effectiveToken && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // If public or has exception, allow through
  if (isPublicRoute || hasPublicException) {
    return NextResponse.next();
  }

  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // No valid token on protected route - redirect to login
  // Exception: community pages redirect to preview instead
  if (!effectiveToken) {
    const communityMatch = pathname.match(/^\/communities\/([^/]+)/);
    if (communityMatch) {
      const communityId = communityMatch[1];
      return NextResponse.redirect(new URL(`/communities/${communityId}/preview`, request.url));
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valid token exists - allow through
  return NextResponse.next();
}

// Configure which paths middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|uploads).*)',
  ],
};
