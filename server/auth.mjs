import { Auth } from '@auth/core';
import Google from '@auth/core/providers/google';
import GitHub from '@auth/core/providers/github';

const basePath = '/api/auth';
const lifetime = 8 * 60 * 60;
const validRoute = /^\/api\/auth\/(providers|session|csrf|signout|(?:signin|callback)\/(?:google|github))$/;

function privateResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Vercel-CDN-Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Vary', 'Cookie');
  return new Response(response.body, { status: response.status, headers });
}

function fail(status, message) {
  return privateResponse(Response.json({ error: message }, { status }));
}

function configuredOrigin(env) {
  if (!URL.canParse(env.AUTH_URL)) return null;
  const url = new URL(env.AUTH_URL);
  const local = !env.VERCEL && env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'http:';
  if (url.protocol !== 'https:' && !local) return null;
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  return url.origin;
}

function configuredProviders(env) {
  const providers = [];
  if (env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim()) {
    providers.push(Google({
      clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: { params: { scope: 'openid profile email' } },
      checks: ['state', 'pkce', 'nonce'],
    }));
  }
  if (env.AUTH_GITHUB_ID?.trim() && env.AUTH_GITHUB_SECRET?.trim()) {
    providers.push(GitHub({
      clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET,
      checks: ['state', 'pkce'],
    }));
  }
  return providers;
}

export async function handleAuth(request, env = process.env) {
  const url = new URL(request.url);
  if (!validRoute.test(url.pathname)) return fail(404, 'Unknown account endpoint');
  const [, , , action, provider] = url.pathname.split('/');
  const posting = action === 'signin' || action === 'signout';
  if (request.method !== (posting ? 'POST' : 'GET')) return fail(405, 'Method not allowed');

  const origin = configuredOrigin(env);
  if (origin && url.origin !== origin) return fail(403, 'Unrecognized account origin');
  if (!origin || !(env.AUTH_SECRET?.trim().length >= 32)) {
    if (action === 'providers') return privateResponse(Response.json({}));
    if (action === 'session') return privateResponse(Response.json(null));
    return fail(503, 'Account access is not configured');
  }
  const providers = configuredProviders(env);
  if (provider && !providers.some(entry => entry.id === provider)) return fail(503, 'Provider unavailable');
  if (posting) {
    if (request.headers.get('origin') !== origin) return fail(403, 'Invalid request origin');
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') {
      return fail(415, 'Expected a URL-encoded form');
    }
  }

  // Only provider callbacks take query parameters. In particular, a caller cannot
  // override the authorization scope, client ID, or redirect URI on a sign-in.
  const target = new URL(url.pathname, origin);
  if (action === 'callback') {
    for (const key of ['code', 'state', 'iss', 'error']) {
      const values = url.searchParams.getAll(key);
      if (values.length > 1) return fail(400, 'Duplicate callback parameter');
      if (values.length === 1) target.searchParams.set(key, values[0]);
    }
  }
  const headers = new Headers();
  headers.set('cookie', request.headers.get('cookie') ?? '');
  let body;
  if (posting) {
    const submitted = new URLSearchParams(await request.text());
    body = new URLSearchParams({ callbackUrl: '/account/', csrfToken: submitted.get('csrfToken') ?? '' });
  }
  const authRequest = new Request(target, { method: request.method, headers, body });
  const secure = target.protocol === 'https:';
  const accountUrl = origin + '/account/';
  const response = await Auth(authRequest, {
    basePath, providers, secret: env.AUTH_SECRET, trustHost: true, useSecureCookies: secure,
    session: { strategy: 'jwt', maxAge: lifetime },
    cookies: secure ? { sessionToken: { name: '__Host-authjs.session-token' } } : {},
    pages: { signIn: '/account/', error: '/account/' },
    callbacks: {
      redirect: () => accountUrl,
      signIn({ account, profile }) {
        if (account?.provider === 'google') return !!profile?.sub && profile.email_verified === true;
        return account?.provider === 'github' && Number.isSafeInteger(profile?.id) && profile.id > 0;
      },
      jwt({ token, user, account }) {
        if (account && user) {
          // The immutable provider ID identifies a person within that provider.
          // Access tokens and refresh tokens have no role after the identity check.
          return { sub: account.provider + ':' + account.providerAccountId, name: user.name,
            email: user.email, validUntil: Date.now() + lifetime * 1000 };
        }
        return token.validUntil > Date.now() ? token : null;
      },
      session({ session, token }) {
        return { user: { name: session.user.name, email: session.user.email },
          expires: new Date(token.validUntil).toISOString() };
      },
    },
    // OAuth errors can carry callback codes and provider responses in their causes.
    logger: { error: error => console.error('[account]', error.type || 'AuthenticationError') },
  });
  return privateResponse(response);
}
