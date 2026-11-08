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

type PublishCode = keyof PublishCall['responses'];

/** A Publish the server took, as `POST /_edity/api/publish` answers it. */
export type Published =
  PublishCall['responses'][202]['content']['application/json'];

type Conflicts = PublishCall['responses'][409]['content']['application/json'];
type Violations = PublishCall['responses'][422]['content']['application/json'];

/** Why a Publish did not go through, when it was not the Draft's fault. */
export type PublishProblem =
  /** 429: too many Publishes lately (V5), with how long to wait, in seconds. */
  | { readonly kind: 'rate-limited'; readonly retryAfter: number | undefined }
  /** 413: the Draft is larger than a Publish can be. */
  | { readonly kind: 'too-large' }
  /** 500: the Site repository cannot be published as it is. */
  | { readonly kind: 'site-broken' }
  /** 503: for now. The Client can publish again later. */
  | { readonly kind: 'unavailable' }
  /** Any other answer the Editor has nothing to tell the Client about. */
  | { readonly kind: 'refused' }
  /** The server could not be reached, or answered nonsense. */
  | { readonly kind: 'offline' };

/** How the server answered a Publish. */
export type PublishResult =
  /** 202: committed, but for the Changes at `conflicts`. */
  | {
      readonly status: 'published';
      readonly sha: Published['sha'];
      readonly version: Published['version'];
      readonly conflicts: readonly string[];
    }
  /** 409: nothing merged. `conflicts` are the Changes that are Conflicts. */
  | { readonly status: 'conflicts'; readonly conflicts: readonly string[] }
  /** 422: what the Field definitions refused, by content path. */
  | { readonly status: 'violations'; readonly violations: readonly string[] }
  /** 401: no session, or an expired one (A3). */
  | { readonly status: 'signed-out' }
  | { readonly status: 'failed'; readonly problem: PublishProblem };

/** Sends a Publish. Never throws. */
export async function publish(request: PublishRequest): Promise<PublishResult> {
  let answer;
  try {
    answer = await api.POST('/_edity/api/publish', { body: request });
  } catch {
    // Unreachable, or a 2xx whose body is not JSON.
    return failed({ kind: 'offline' });
  }
  const { data, error, response } = answer;
  // `satisfies` keeps each status the Editor tells apart in the file.
  switch (response.status) {
    case 202 satisfies PublishCode:
      return isPublished(data)
        ? {
            status: 'published',
            sha: data.sha,
            version: data.version,
            conflicts: pathsOf(data.conflicts ?? []),
          }
        : failed({ kind: 'offline' });
    case 401 satisfies PublishCode:
      return { status: 'signed-out' };
    case 409 satisfies PublishCode:
      return isConflicts(error)
        ? { status: 'conflicts', conflicts: pathsOf(error.conflicts) }
        : failed({ kind: 'refused' });
    case 413 satisfies PublishCode:
      return failed({ kind: 'too-large' });
    case 422 satisfies PublishCode:
      return isViolations(error)
        ? { status: 'violations', violations: pathsOf(error.violations) }
        : failed({ kind: 'refused' });
    case 429 satisfies PublishCode:
      return failed({
        kind: 'rate-limited',
        retryAfter: retryAfterOf(response),
      });
    case 500 satisfies PublishCode:
      return failed({ kind: 'site-broken' });
    case 503 satisfies PublishCode:
      return failed({ kind: 'unavailable' });
    default:
      return failed({ kind: 'refused' });
  }
}

function failed(problem: PublishProblem): PublishResult {
  return { status: 'failed', problem };
}

/** The distinct content paths of Conflicts or violations. */
function pathsOf(
  found: readonly { readonly path: string }[],
): readonly string[] {
  return [...new Set(found.map(({ path }) => path))];
}

/** The seconds a response says to wait, if it says. */
function retryAfterOf(response: Response): number | undefined {
  const seconds = Number(response.headers.get('Retry-After') ?? Number.NaN);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
}

/** Where the Release of a Publish's commit is (P4). */
export type PublishStatus =
  PublishStatusCall['responses'][200]['content']['application/json'];

/** How the server answered about a Publish's progress. */
export type PublishStatusResult =
  | ({ readonly status: 'known' } & PublishStatus)
  /** 404: not a Publish's commit, or no longer one on the Site. */
  | { readonly status: 'not-found' }
  /** 401: no session, or an expired one. */
  | { readonly status: 'signed-out' }
  /** The server could not say for now. Ask again, after `retryAfter` s. */
  | { readonly status: 'unknown'; readonly retryAfter: number | undefined };

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
    return { status: 'unknown', retryAfter: undefined };
  }
  const { data, response } = answer;
  type Code = keyof PublishStatusCall['responses'];
  if (response.status === (401 satisfies Code)) return { status: 'signed-out' };
  if (response.status === (404 satisfies Code)) return { status: 'not-found' };
  return isPublishStatus(data)
    ? { status: 'known', ...data }
    : { status: 'unknown', retryAfter: retryAfterOf(response) };
}

function isPublished(body: unknown): body is Published {
  if (typeof body !== 'object' || body === null) return false;
  const { sha, version, conflicts } = body as Partial<
    Record<keyof Published, unknown>
  >;
  return (
    typeof sha === 'string' &&
    typeof version === 'string' &&
    (conflicts === undefined || isPathList(conflicts))
  );
}

function isConflicts(body: unknown): body is Conflicts {
  return (
    typeof body === 'object' &&
    body !== null &&
    isPathList((body as Partial<Conflicts>).conflicts)
  );
}

function isViolations(body: unknown): body is Violations {
  return (
    typeof body === 'object' &&
    body !== null &&
    isPathList((body as Partial<Violations>).violations)
  );
}

function isPathList(found: unknown): found is { readonly path: string }[] {
  return (
    Array.isArray(found) &&
    found.every(
      (each: { readonly path?: unknown } | null) =>
        typeof each?.path === 'string',
    )
  );
}

/** Whether the status call's 200 answered a stage the file has. */
function isPublishStatus(body: unknown): body is PublishStatus {
  if (typeof body !== 'object' || body === null) return false;
  const { stage, version } = body as Partial<
    Record<keyof PublishStatus, unknown>
  >;
  return (
    typeof stage === 'string' &&
    Object.hasOwn(stages, stage) &&
    typeof version === 'string'
  );
}

/** Every stage the server can answer: a change to the file fails the type-check. */
const stages: Readonly<Record<PublishStatus['stage'], true>> = {
  validating: true,
  releasing: true,
  released: true,
  deploying: true,
  live: true,
  failed: true,
};

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
