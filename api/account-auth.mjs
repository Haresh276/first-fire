import { handleAuth } from '../server/auth.mjs';

export default {
  fetch(request) {
    const url = new URL(request.url);
    // Vercel can supply the original URL or the rewritten function URL.
    if (url.pathname === '/api/account-auth' && url.searchParams.getAll('accountRoute').length === 1) {
      const route = url.searchParams.get('accountRoute');
      if (/^[a-z]+(?:\/[a-z]+)?$/.test(route)) {
        url.pathname = '/api/auth/' + route;
        url.searchParams.delete('accountRoute');
        request = new Request(url, request);
      }
    }
    return handleAuth(request);
  },
};
