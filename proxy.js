import { NextResponse } from 'next/server';
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/session';

export default function proxy(request) {
    const { pathname, search } = request.nextUrl;

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionCookieValue(sessionCookie);

    if (session) {
        return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const loginUrl = new URL('/api/auth/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname + search);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
