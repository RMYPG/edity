// The Editor's calls to edity-server, which each Site routes at /_edity/api/
// on its own origin (ADR-0001). Everything that knows the API's routes and
// bodies stays in this module.
//
// edity-server owns the API's OpenAPI file (N10), pinned in api/openapi.yaml,
// and `mise run api:generate` writes its types to openapi.ts. Every call goes
// through an API client typed by them, and every body type here is theirs,
// so a change to the file that breaks the Editor fails the type-check.
import createClient from 'openapi-fetch';
import type { Change } from './draft.js';
import type { paths } from './openapi.js';

/** The API, on the page's own origin. */
const api = createClient<paths>();

type SessionCall = paths['/_edity/api/session']['get'];
type PublishCall = paths['/_edity/api/publish']['post'];
type PublishStatusCall = paths['/_edity/api/publish/{sha}']['get'];

/** The signed-in Client, as `GET /_edity/api/session` returns them. */
export type Session =
  SessionCall['responses'][200]['content']['application/json'];

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
  let answer;
  try {
    answer = await api.GET('/_edity/api/session', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch (error) {
    // Unreachable, or a 2xx whose body is not JSON.
    return { status: 'unavailable', reason: String(error) };
  }
  const { data, response } = answer;
  // `satisfies` keeps each status the Editor tells apart in the file.
  if (response.status === (401 satisfies keyof SessionCall['responses'])) {
    return { status: 'signed-out' };
  }
  if (!response.ok) {
    return { status: 'unavailable', reason: `HTTP ${response.status}` };
  }
  if (!isSession(data)) {
    return { status: 'unavailable', reason: 'not a session' };
  }
  return { status: 'signed-in', session: data };
}

/**
 * What `POST /_edity/api/publish` takes (P3): the page, and only the Draft's
 * Changes, each with its value before and after.
 */
export type PublishRequest =
  PublishCall['requestBody']['content']['application/json'];

/** One Change, as Publish sends it. */
export type PublishedChange = PublishRequest['changes'][number];

/** What Publish sends for the Draft `changes` of `page`. */
export function publishRequest(
  page: string,
  changes: Iterable<Change>,
): PublishRequest {
  return {
    page,
    changes: Array.from(changes, ({ path, before, after }) => ({
      path,
      before,
      after,
    })),
  };
}

/** A Publish the server took, as `POST /_edity/api/publish` answers it. */
export type Published =
  PublishCall['responses'][202]['content']['application/json'];

/** How the server answered a Publish. */
export type PublishResult =
  | {
      readonly status: 'published';
      readonly sha: Published['sha'];
      readonly version: Published['version'];
    }
  /** The server could not be reached, failed or answered nonsense. */
  | { readonly status: 'failed' };

/** Sends a Publish. Never throws. */
export async function publish(request: PublishRequest): Promise<PublishResult> {
  let answer;
  try {
    answer = await api.POST('/_edity/api/publish', { body: request });
  } catch {
    // Unreachable, or a 2xx whose body is not JSON.
    return { status: 'failed' };
  }
  const { data, response } = answer;
  if (response.status === (202 satisfies keyof PublishCall['responses'])) {
    if (data !== undefined) {
      return { status: 'published', sha: data.sha, version: data.version };
    }
  }
  return { status: 'failed' };
}

/** Where the Release of a Publish's commit is (P4). */
export type PublishStatus =
  PublishStatusCall['responses'][200]['content']['application/json'];

/** How the server answered about a Publish's progress. */
export type PublishStatusResult =
  | ({ readonly status: 'known' } & PublishStatus)
  /** The server could not say, for now. */
  | { readonly status: 'unknown' };

/** Asks how the Publish of commit `sha` is going. Never throws. */
export async function getPublishStatus(
  sha: string,
): Promise<PublishStatusResult> {
  let answer;
  try {
    answer = await api.GET('/_edity/api/publish/{sha}', {
      params: { path: { sha } },
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return { status: 'unknown' };
  }
  const { data } = answer;
  return data === undefined
    ? { status: 'unknown' }
    : { status: 'known', ...data };
}

/** Whether the session call's 200 answered a session, as the file says. */
function isSession(body: unknown): body is Session {
  if (typeof body !== 'object' || body === null) return false;
  // Typed by Session's keys, so a key the file renames fails the type-check.
  const { name, locale, site } = body as Partial<
    Record<keyof Session, unknown>
  >;
  return (
    typeof name === 'string' &&
    typeof locale === 'string' &&
    typeof site === 'string'
  );
}
