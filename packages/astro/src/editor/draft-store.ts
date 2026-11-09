// Keeping a page's Draft in the browser (P2), so it comes back after a
// reload or a closed tab: in localStorage, under a key for the Site and the
// page. A Publish's progress and the Changes it published are kept the same
// way, so they come back too (P4). Storage can be blocked, full or cleared at
// any time (Safari deletes it after 7 days without a visit), so nothing here
// ever throws, and what cannot be kept is only in memory.
import { effect, untracked } from '@preact/signals';
import type { Change, ContentValue, Draft } from './draft.js';
import type { CommittedChange } from './published.js';
import type { Progress } from './publishing.js';

/** The part of the browser's `Storage` the Draft is kept in. */
export type KeptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The browser's own storage, which may throw when it is blocked. */
const browserStorage = (): KeptStorage => window.localStorage;

/** Where one page's Changes of some kind are kept. */
interface ChangeStore<T extends Change> {
  /**
   * The Changes kept for the page, in the order the Client made them. None
   * when there are none, or what is kept cannot be read.
   */
  load(): T[];
  /** Keeps `changes` for the page, or forgets its Draft when there are none. */
  keep(changes: Iterable<T>): void;
}

/** Where one page's Draft is kept. */
export type DraftStore = ChangeStore<Change>;

/** Where the Changes one page has published are kept. */
export type PublishedStore = ChangeStore<CommittedChange>;

/** What is kept under a Draft's key, as JSON. */
interface Kept<T extends Change> {
  readonly changes: readonly T[];
}

/**
 * Where the Draft of `page` on `site` is kept. `site` is the session's Site,
 * which tells apart Sites served from one origin, as in development.
 * `storage` returns the browser's storage, and may throw when it is blocked.
 */
export function draftStore(
  site: string,
  page: string,
  storage: () => KeptStorage = browserStorage,
): DraftStore {
  return changeStore(pageKey('draft', site, page), storage, isChange);
}

/**
 * Where the Changes `page` on `site` has published are kept, until the page
 * is built with them (`stillToBuild`).
 */
export function publishedStore(
  site: string,
  page: string,
  storage: () => KeptStorage = browserStorage,
): PublishedStore {
  return changeStore(
    pageKey('published', site, page),
    storage,
    isCommittedChange,
  );
}

function pageKey(kind: string, site: string, page: string): string {
  return `edity:${kind}:v1:${encodeURIComponent(site)}:${encodeURIComponent(page)}`;
}

function changeStore<T extends Change>(
  key: string,
  storage: () => KeptStorage,
  isKept: (value: unknown) => value is T,
): ChangeStore<T> {
  return {
    load() {
      let kept: unknown;
      try {
        kept = JSON.parse(storage().getItem(key) ?? 'null');
      } catch {
        return [];
      }
      if (
        typeof kept !== 'object' ||
        kept === null ||
        !Array.isArray((kept as Partial<Kept<T>>).changes)
      ) {
        return [];
      }
      return (kept as Kept<T>).changes.filter(isKept);
    },
    keep(changes) {
      const kept: Kept<T> = { changes: [...changes] };
      try {
        if (kept.changes.length === 0) storage().removeItem(key);
        else storage().setItem(key, JSON.stringify(kept));
      } catch {
        // Full or blocked: the Draft is still in memory, until the page goes.
      }
    },
  };
}

/** Where a Site's followed Publish is kept. */
export interface ProgressStore {
  /** The Publish kept for the Site, if what is kept can be read. */
  load(): Progress | undefined;
  /** Keeps `progress` for the Site, or forgets it when there is none. */
  keep(progress: Progress | undefined): void;
}

/**
 * Where the Publish followed on `site` is kept: one for each Site, as its
 * Release is the whole Site's.
 */
export function progressStore(
  site: string,
  storage: () => KeptStorage = browserStorage,
): ProgressStore {
  const key = `edity:publish:v1:${encodeURIComponent(site)}`;
  return {
    load() {
      try {
        const kept: unknown = JSON.parse(storage().getItem(key) ?? 'null');
        return isProgress(kept) ? kept : undefined;
      } catch {
        return undefined;
      }
    },
    keep(progress) {
      try {
        if (progress === undefined) storage().removeItem(key);
        else storage().setItem(key, JSON.stringify(progress));
      } catch {
        // Full or blocked: it is still followed, until the page goes.
      }
    },
  };
}

/**
 * Remembers, for the tab, that a Client was sent to log in from a Publish, so
 * the Editor can tell them why they are back (A3). Kept in sessionStorage,
 * which the redirects through Zitadel leave as they found it.
 */
export interface LoginReturnStore {
  mark(): void;
  /** Whether they were sent there, once: it also forgets it. */
  take(): boolean;
}

export function loginReturnStore(
  site: string,
  storage: () => KeptStorage = () => window.sessionStorage,
): LoginReturnStore {
  const key = `edity:login-return:v1:${encodeURIComponent(site)}`;
  return {
    mark() {
      try {
        storage().setItem(key, '1');
      } catch {
        // Blocked: the Client just gets no word of it on return.
      }
    },
    take() {
      try {
        const marked = storage().getItem(key) !== null;
        storage().removeItem(key);
        return marked;
      } catch {
        return false;
      }
    },
  };
}

/** Keeps `draft` in `store` from now on, each time it changes. */
export function keepDraft(draft: Draft, store: DraftStore): () => void {
  return effect(() => {
    const changes = draft.changes.value;
    untracked(() => store.keep(changes.values()));
  });
}

function isChange(value: unknown): value is Change {
  if (typeof value !== 'object' || value === null) return false;
  const { path, before, after, origins } = value as Record<string, unknown>;
  return (
    typeof path === 'string' &&
    path !== '' &&
    isContentValue(before) &&
    isContentValue(after) &&
    (origins === undefined ||
      (Array.isArray(origins) &&
        origins.every(
          (origin) =>
            origin === null || (Number.isInteger(origin) && origin >= 0),
        )))
  );
}

function isCommittedChange(value: unknown): value is CommittedChange {
  if (!isChange(value)) return false;
  const { sha } = value as CommittedChange;
  return sha === undefined || isSha(sha);
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function isProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false;
  const { sha, version, page, stage } = value as Record<string, unknown>;
  return (
    isSha(sha) &&
    typeof version === 'string' &&
    typeof page === 'string' &&
    (stage === 'validating' ||
      stage === 'releasing' ||
      stage === 'released' ||
      stage === 'failed')
  );
}

function isContentValue(value: unknown): value is ContentValue {
  switch (typeof value) {
    case 'string':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      return (
        value !== null &&
        (Array.isArray(value) ? value : Object.values(value)).every(
          isContentValue,
        )
      );
    default:
      return false;
  }
}
