// The Editor's calls to edity-server, which each Site routes at /_edity/api/
// on its own origin (ADR-0001). Everything that knows the API's routes and
// bodies stays in this module.
//
// TODO(ticket 18): make these calls through the client generated from
// edity-server's OpenAPI file, keeping the functions' signatures.

/** The signed-in Client, as `GET /_edity/api/session` returns them. */
export interface Session {
  /** The Client's name. */
  readonly name: string;
  /** The Client's locale in Zitadel, such as `es` or `en-GB`. */
  readonly locale: string;
  /** The Site the session is for. */
  readonly site: string;
}

/** What the server says about the browser's session. */
export type SessionResult =
  | { readonly status: 'signed-in'; readonly session: Session }
  /** 401: no session, or an expired one. */
  | { readonly status: 'signed-out' }
  /** The server could not be reached, failed or answered nonsense. */
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * Asks the server who is signed in. The session cookie is HttpOnly and
 * scoped to `/_edity/api` (A2), so only the server can tell. Never throws.
 */
export async function getSession(): Promise<SessionResult> {
  let response: Response;
  try {
    response = await fetch('/_edity/api/session', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (error) {
    return { status: 'unavailable', reason: String(error) };
  }
  if (response.status === 401) return { status: 'signed-out' };
  if (!response.ok) {
    return { status: 'unavailable', reason: `HTTP ${response.status}` };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!isSession(body)) {
    return { status: 'unavailable', reason: 'not a session' };
  }
  return { status: 'signed-in', session: body };
}

function isSession(body: unknown): body is Session {
  if (typeof body !== 'object' || body === null) return false;
  const { name, locale, site } = body as Record<string, unknown>;
  return (
    typeof name === 'string' &&
    typeof locale === 'string' &&
    typeof site === 'string'
  );
}
