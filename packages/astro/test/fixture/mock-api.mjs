// @ts-check
// Stands in for edity-server's login and session routes under `astro dev`,
// so the Editor can be tried on this Site by hand. Only `astro dev` runs it:
// builds and `astro preview` never include it, and browser tests mock the
// API with page.route() instead.
//
//   /_edity/login                      signs in as Ana, in Spanish
//   /_edity/login?name=Sam&locale=en   signs in as Sam, in English
//   /_edity/login?expired              leaves only the marker cookie, as an
//                                      expired session does: the Editor gets
//                                      a 401 and removes itself
//   POST /_edity/api/auth/logout       signs out
//
// Like the real server, it sets an HttpOnly session cookie scoped to
// /_edity/api and the edity=1 marker cookie that the inline check looks for.
import { URL } from 'node:url';

const sessionCookie = 'edity_session';

/** @returns {import('astro').AstroIntegration} */
export default function mockApi() {
  return {
    name: 'edity-fixture-mock-api',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const route = `${req.method} ${url.pathname}`;
          if (route === 'GET /_edity/login') {
            const session = {
              name: url.searchParams.get('name') ?? 'Ana',
              locale: url.searchParams.get('locale') ?? 'es',
              site: 'fixture',
            };
            res.setHeader('Set-Cookie', [
              url.searchParams.has('expired')
                ? `${sessionCookie}=; Path=/_edity/api; Max-Age=0; HttpOnly; SameSite=Lax`
                : `${sessionCookie}=${encodeURIComponent(JSON.stringify(session))}; Path=/_edity/api; HttpOnly; SameSite=Lax`,
              'edity=1; Path=/; SameSite=Lax',
            ]);
            res.writeHead(303, { Location: '/' }).end();
            return;
          }
          if (route === 'GET /_edity/api/session') {
            const session = readCookie(req.headers.cookie, sessionCookie);
            if (session === undefined) {
              res.writeHead(401).end();
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(decodeURIComponent(session));
            return;
          }
          if (route === 'POST /_edity/api/auth/logout') {
            res.setHeader('Set-Cookie', [
              `${sessionCookie}=; Path=/_edity/api; Max-Age=0; HttpOnly; SameSite=Lax`,
              'edity=; Path=/; Max-Age=0',
            ]);
            res.writeHead(204).end();
            return;
          }
          next();
        });
      },
    },
  };
}

/**
 * The value of the cookie `name` in a Cookie header.
 * @param {string | undefined} header
 * @param {string} name
 */
function readCookie(header, name) {
  for (const cookie of header?.split('; ') ?? []) {
    const [key, value] = cookie.split('=');
    if (key === name && value) return value;
  }
  return undefined;
}
