import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

const PUBLIC_FILE = /\.(.*)$/;

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === '/login';
  const isAdminRoute = pathname.startsWith('/admin');
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/data/') ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname);

  if (isApiAuthRoute || isPublicAsset) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  if (isAdminRoute && req.auth) {
    const role = (req.auth.user as { role?: string }).role;
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
