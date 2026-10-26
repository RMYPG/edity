// Keeping a page's Draft in the browser (P2), so it comes back after a
// reload or a closed tab: in localStorage, under a key for the Site and the
// page. Storage can be blocked, full or cleared at any time (Safari deletes
// it after 7 days without a visit), so nothing here ever throws, and a
// Draft that cannot be kept is only in memory.
import { effect, untracked } from '@preact/signals';
import type { Change, ContentValue, Draft } from './draft.js';

/** The part of the browser's `Storage` the Draft is kept in. */
export type KeptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Where one page's Draft is kept. */
export interface DraftStore {
  /**
   * The Changes kept for the page, in the order the Client made them. None
   * when there are none, or what is kept cannot be read.
   */
  load(): Change[];
  /** Keeps `changes` for the page, or forgets its Draft when there are none. */
  keep(changes: Iterable<Change>): void;
}

/** What is kept under a Draft's key, as JSON. */
interface Kept {
  readonly changes: readonly Change[];
}

/**
 * Where the Draft of `page` on `site` is kept. `site` is the session's Site,
 * which tells apart Sites served from one origin, as in development.
 * `storage` returns the browser's storage, and may throw when it is blocked.
 */
export function draftStore(
  site: string,
  page: string,
  storage: () => KeptStorage = () => window.localStorage,
): DraftStore {
  const key = `edity:draft:v1:${encodeURIComponent(site)}:${encodeURIComponent(page)}`;
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
        !Array.isArray((kept as Partial<Kept>).changes)
      ) {
        return [];
      }
      return (kept as Kept).changes.filter(isChange);
    },
    keep(changes) {
      const kept: Kept = { changes: [...changes] };
      try {
        if (kept.changes.length === 0) storage().removeItem(key);
        else storage().setItem(key, JSON.stringify(kept));
      } catch {
        // Full or blocked: the Draft is still in memory, until the page goes.
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
