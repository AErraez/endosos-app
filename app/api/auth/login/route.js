import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const rawReturnTo = searchParams.get('returnTo') || '/';
    const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/';

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const redirectUri = process.env.AZURE_REDIRECT_URI;

    const state = crypto.randomBytes(16).toString('base64url');

    const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_mode', 'query');
    authorizeUrl.searchParams.set('scope', 'openid profile email');
    authorizeUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set('oauth_state', JSON.stringify({ state, returnTo }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 300,
    });
    return response;
}
