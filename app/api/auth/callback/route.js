import { NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from '@/lib/session';

const ALLOWED_DOMAIN = 'equisuiza.com';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
        return NextResponse.json({ error: 'Inicio de sesión cancelado o denegado' }, { status: 401 });
    }

    const stateCookie = request.cookies.get('oauth_state')?.value;
    let expectedState, returnTo;
    try {
        ({ state: expectedState, returnTo } = JSON.parse(stateCookie));
    } catch {
        return NextResponse.json({ error: 'Intento de inicio de sesión inválido o expirado' }, { status: 400 });
    }

    if (!code || !state || state !== expectedState) {
        return NextResponse.json({ error: 'Intento de inicio de sesión inválido o expirado' }, { status: 400 });
    }

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const redirectUri = process.env.AZURE_REDIRECT_URI;

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });

    if (!tokenResponse.ok) {
        console.error('Azure AD token exchange failed', await tokenResponse.text());
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 401 });
    }

    const tokens = await tokenResponse.json();

    const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));

    let payload;
    try {
        ({ payload } = await jwtVerify(tokens.id_token, jwks, {
            issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
            audience: clientId,
        }));
    } catch (e) {
        console.error('Azure AD id_token verification failed', e);
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 401 });
    }

    if (payload.tid !== tenantId) {
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 401 });
    }

    const email = (payload.email || payload.preferred_username || '').toLowerCase();
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return NextResponse.json({ error: 'Acceso restringido a cuentas de equisuiza.com' }, { status: 403 });
    }

    const safeReturnTo = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

    const response = NextResponse.redirect(new URL(safeReturnTo, request.url));
    response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue({ email, name: payload.name }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_COOKIE_MAX_AGE,
    });
    response.cookies.delete('oauth_state');
    return response;
}
