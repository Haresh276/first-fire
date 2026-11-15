import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { handleAuth } from '../server/auth.mjs';

const origin = 'https://lab.example';
const config = {
  AUTH_URL: origin,
  AUTH_SECRET: 'local-test-only-session-encryption-secret-01234',
  AUTH_GOOGLE_ID: 'fake-google-client',
  AUTH_GOOGLE_SECRET: 'unpublished-google-test-secret',
  AUTH_GITHUB_ID: 'fake-github-client',
  AUTH_GITHUB_SECRET: 'unpublished-github-test-secret',
};
const accessToken = 'test-only-provider-access-token';

// Carry cookies exactly as a browser does, including deletion on sign-out.
class Browser {
  cookies = new Map();

  constructor(env = config) {
    this.env = env;
  }

  async request(path, { form, requestOrigin = origin } = {}) {
    const headers = new Headers();
    headers.set('Cookie', Array.from(this.cookies, ([name, value]) => name + '=' + value).join('; '));
    if (form) headers.set('Origin', requestOrigin);
    const request = new Request(new URL('/api/auth/' + path, origin), {
      method: form ? 'POST' : 'GET',
      headers,
      body: form ? new URLSearchParams(form) : undefined,
    });
    const result = await handleAuth(request, this.env);
    assert.match(result.headers.get('Cache-Control') ?? '', /\bno-store\b/i);
    const text = await result.clone().text();
    const exposed = text + JSON.stringify(Array.from(result.headers));
    for (const secret of [config.AUTH_SECRET, config.AUTH_GOOGLE_SECRET, config.AUTH_GITHUB_SECRET, accessToken]) {
      assert.ok(!exposed.includes(secret), 'The response exposed a server credential or provider token');
    }
    for (const cookie of result.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const equals = pair.indexOf('=');
      const name = pair.slice(0, equals);
      const value = pair.slice(equals + 1);
      if (value === '' || /;\s*Max-Age=0(?:;|$)/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return result;
  }

  async csrf() {
    const response = await this.request('csrf');
    assert.equal(response.status, 200);
    const { csrfToken } = await response.json();
    assert.ok(csrfToken.length >= 32);
    return csrfToken;
  }

  async signIn(provider) {
    const csrfToken = await this.csrf();
    return this.request('signin/' + provider, { form: { csrfToken, callbackUrl: origin + '/' } });
  }

  async session() {
    const response = await this.request('session');
    assert.equal(response.status, 200);
    return response.json();
  }
}

function assertCookie(response, type) {
  const cookie = response.headers.getSetCookie().find(line => line.split('=', 1)[0].endsWith('.' + type));
  assert.ok(cookie, 'Missing ' + type + ' cookie');
  assert.match(cookie, /;\s*HttpOnly(?:;|$)/i);
  assert.match(cookie, /;\s*Secure(?:;|$)/i);
  assert.match(cookie, /;\s*SameSite=(?:Lax|Strict)(?:;|$)/i);
  assert.match(cookie, /;\s*Path=\/(?:;|$)/i);
  assert.doesNotMatch(cookie, /;\s*Domain=/i);
}

function assertRejected(response) {
  const location = response.headers.get('Location');
  if (location) {
    const redirect = new URL(location, origin);
    assert.equal(redirect.origin, origin);
    assert.match(redirect.href, /error|csrf|denied/i);
  } else {
    assert.ok(response.status >= 400, 'Expected the auth action to fail closed');
  }
}

function mockProviderFetch(t, respond) {
  return t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init);
    if (request.url === 'https://accounts.google.com/.well-known/openid-configuration') {
      return Response.json({
        issuer: 'https://accounts.google.com',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (respond) return respond(request);
    throw new Error('Unexpected provider request ' + request.url);
  });
}

test('guests can discover configured providers and get a CSRF token without a session', async () => {
  const browser = new Browser();
  const providers = await (await browser.request('providers')).json();
  for (const provider of ['google', 'github']) {
    assert.equal(providers[provider].id, provider);
    assert.equal(providers[provider].callbackUrl, origin + '/api/auth/callback/' + provider);
  }
  const csrf = await browser.request('csrf');
  assertCookie(csrf, 'csrf-token');
  assert.ok((await csrf.json()).csrfToken);
  assert.equal(await browser.session(), null);
  browser.cookies.set('__Host-authjs.session-token', 'forged-session');
  assert.equal(await browser.session(), null);
});

test('missing and partial configuration keep unavailable providers closed', async () => {
  for (const env of [{}, { ...config, AUTH_SECRET: 'short' }, { ...config, AUTH_URL: 'http://lab.example' }]) {
    const browser = new Browser(env);
    assert.deepEqual(await (await browser.request('providers')).json(), {});
    assert.equal(await browser.session(), null);
    assert.equal((await browser.request('csrf')).status, 503);
    assert.equal((await browser.request('signin/google', { form: {} })).status, 503);
  }
  for (const [available, missing] of [['google', 'github'], ['github', 'google']]) {
    const env = { ...config };
    delete env['AUTH_' + missing.toUpperCase() + '_SECRET'];
    const browser = new Browser(env);
    assert.deepEqual(Object.keys(await (await browser.request('providers')).json()), [available]);
    assert.equal((await browser.request('signin/' + missing, { form: { csrfToken: await browser.csrf() } })).status, 503);
    assert.equal((await browser.request('callback/' + missing + '?code=test')).status, 503);
  }
});

test('mutating sign-in requires the matching CSRF token and same origin', async t => {
  mockProviderFetch(t);
  const browser = new Browser();
  const csrfToken = await browser.csrf();
  for (const options of [
    { form: {} },
    { form: { csrfToken: 'tampered' } },
    { form: { csrfToken }, requestOrigin: 'https://attacker.example' },
  ]) {
    assertRejected(await browser.request('signin/github', options));
  }
  assertRejected(await new Browser().request('signin/github', { form: { csrfToken } }));
});

for (const provider of ['google', 'github']) {
  test(provider + ' sign-in binds a new authorization code flow to this browser', async t => {
    mockProviderFetch(t);
    const browser = new Browser();
    const response = await browser.signIn(provider);
    assert.ok([302, 303, 307].includes(response.status));
    const target = new URL(response.headers.get('Location'));
    assert.equal(target.origin, provider === 'google' ? 'https://accounts.google.com' : 'https://github.com');
    const params = target.searchParams;
    assert.equal(params.get('redirect_uri'), origin + '/api/auth/callback/' + provider);
    assert.equal(params.get('client_id'), config['AUTH_' + provider.toUpperCase() + '_ID']);
    assert.equal(params.get('response_type'), 'code');
    assert.equal(params.get('code_challenge_method'), 'S256');
    assert.match(params.get('code_challenge') ?? '', /^[\w-]{43}$/);
    assertCookie(response, 'pkce.code_verifier');
    assert.ok(params.get('state'));
    assertCookie(response, 'state');
    if (provider === 'google') {
      assert.ok(params.get('nonce'));
      assertCookie(response, 'nonce');
    }
    const another = await new Browser().signIn(provider);
    const next = new URL(another.headers.get('Location')).searchParams;
    assert.notEqual(next.get('state'), params.get('state'));
    assert.notEqual(next.get('code_challenge'), params.get('code_challenge'));
    if (provider === 'google') assert.notEqual(next.get('nonce'), params.get('nonce'));
  });
}

test('callback with missing or mismatched state cannot exchange a code or create a session', async t => {
  const outbound = mockProviderFetch(t);
  const browser = new Browser();
  await browser.signIn('github');
  for (const path of [
    'callback/github?code=fake-code',
    'callback/github?code=fake-code&state=incorrect',
  ]) {
    assertRejected(await browser.request(path));
    assert.equal(await browser.session(), null);
  }
  assert.equal(outbound.mock.callCount(), 0);
});

test('authorization scopes, client ID and callback destinations remain fixed', async t => {
  mockProviderFetch(t);
  const browser = new Browser();
  const csrfToken = await browser.csrf();
  const attacker = 'https://attacker.example/';
  const injected = new URLSearchParams({ scope: 'admin:org', redirect_uri: attacker, client_id: 'other', callbackUrl: attacker });
  const start = await browser.request('signin/github?' + injected, { form: { csrfToken, callbackUrl: attacker } });
  const authorize = new URL(start.headers.get('Location')).searchParams;
  assert.equal(authorize.get('scope'), 'read:user user:email');
  assert.equal(authorize.get('redirect_uri'), origin + '/api/auth/callback/github');
  assert.equal(authorize.get('client_id'), config.AUTH_GITHUB_ID);
  assert.ok(!authorize.toString().includes('attacker'));
  const signout = await browser.request('signout', { form: { csrfToken, callbackUrl: attacker } });
  assert.equal(signout.headers.get('Location'), origin + '/account/');
});

test('GitHub callback exchanges the verifier, sets an encrypted session, and signs out with CSRF', async t => {
  let receivedChallenge;
  let receivedUserToken;
  mockProviderFetch(t, async request => {
    if (request.url === 'https://github.com/login/oauth/access_token') {
      const body = new URLSearchParams(await request.text());
      assert.equal(body.get('code'), 'single-use-test-code');
      assert.equal(body.get('redirect_uri'), origin + '/api/auth/callback/github');
      receivedChallenge = createHash('sha256').update(body.get('code_verifier')).digest('base64url');
      return Response.json({ access_token: accessToken, token_type: 'bearer', scope: 'read:user' });
    }
    if (request.url === 'https://api.github.com/user') {
      receivedUserToken = request.headers.get('Authorization');
      return Response.json({ id: 42, name: 'Researcher', login: 'researcher', email: 'test@example.org' });
    }
    if (request.url === 'https://api.github.com/user/emails') {
      return Response.json([{ email: 'test@example.org', verified: true, primary: true }]);
    }
    throw new Error('Unexpected provider request ' + request.url);
  });
  const browser = new Browser();
  const signIn = await browser.signIn('github');
  const params = new URL(signIn.headers.get('Location')).searchParams;
  const callbackParams = new URLSearchParams({ state: params.get('state'), code: 'single-use-test-code' });
  const complete = await browser.request('callback/github?' + callbackParams);
  assert.equal(complete.headers.get('Location'), origin + '/account/');
  assert.equal(receivedChallenge, params.get('code_challenge'));
  assert.equal(receivedUserToken, 'Bearer ' + accessToken);
  assertCookie(complete, 'session-token');
  const session = await browser.session();
  assert.equal(session.user.name, 'Researcher');
  assert.ok(Date.parse(session.expires) > Date.now());
  const copied = new Browser();
  for (const [name, value] of browser.cookies) {
    if (name.endsWith('.session-token')) {
      // Flip a character in the authenticated ciphertext, retaining valid JWT syntax.
      const parts = value.split('.');
      assert.equal(parts.length, 5, 'Expected an encrypted compact session token');
      parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
      copied.cookies.set(name, parts.join('.'));
    }
  }
  assert.equal(await copied.session(), null);
  const csrfToken = await browser.csrf();
  assertRejected(await browser.request('signout', { form: { csrfToken: 'tampered' } }));
  assert.equal((await browser.session()).user.name, 'Researcher');
  assertRejected(await browser.request('signout', { form: { csrfToken }, requestOrigin: 'https://attacker.example' }));
  assert.equal((await browser.session()).user.name, 'Researcher');
  await browser.request('signout', { form: { csrfToken, callbackUrl: origin + '/' } });
  assert.equal(await browser.session(), null);
});

test('Google verifies OIDC claims and ends an active session at the original eight-hour limit', async t => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyId = 'local-id-token-key';
  const publicJwk = { ...publicKey.export({ format: 'jwk' }), alg: 'RS256', use: 'sig', kid: keyId };
  let claims;
  let exchanges = 0;
  mockProviderFetch(t, async request => {
    if (request.url === 'https://www.googleapis.com/oauth2/v3/certs') {
      return Response.json({ keys: [publicJwk] });
    }
    assert.equal(request.url, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(await request.text());
    assert.equal(body.get('code'), 'google-fixture-' + (++exchanges));
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const signingInput = encode({ alg: 'RS256', kid: keyId }) + '.' + encode(claims);
    const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
    return Response.json({ access_token: accessToken, token_type: 'bearer', id_token: signingInput + '.' + signature });
  });

  for (const variant of ['unverified email', 'incorrect nonce', 'valid']) {
    const browser = new Browser();
    const start = await browser.signIn('google');
    const params = new URL(start.headers.get('Location')).searchParams;
    const issued = Math.floor(Date.now() / 1000);
    claims = {
      iss: 'https://accounts.google.com', aud: config.AUTH_GOOGLE_ID, sub: '123456',
      email: 'google-fixture@example.org', name: 'Google Researcher', iat: issued, exp: issued + 3600,
      email_verified: variant !== 'unverified email',
      nonce: variant === 'incorrect nonce' ? 'other-login-nonce' : params.get('nonce'),
    };
    const query = new URLSearchParams({ code: 'google-fixture-' + (exchanges + 1), state: params.get('state') });
    const callback = await browser.request('callback/google?' + query);
    if (variant !== 'valid') {
      assertRejected(callback);
      assert.equal(await browser.session(), null);
      continue;
    }
    assert.equal(callback.headers.get('Location'), origin + '/account/');
    assertCookie(callback, 'session-token');
    const session = await browser.session();
    assert.deepEqual(session.user, { name: claims.name, email: claims.email });
    const expires = Date.parse(session.expires);
    assert.ok(Math.abs(expires - Date.now() - 8 * 60 * 60 * 1000) < 2000);
    t.mock.timers.enable({ apis: ['Date'], now: expires - 60000 });
    assert.equal((await browser.session()).expires, session.expires);
    t.mock.timers.tick(60001);
    assert.equal(await browser.session(), null);
  }
  assert.equal(exchanges, 3);
});
