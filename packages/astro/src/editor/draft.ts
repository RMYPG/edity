import { computed, signal, type ReadonlySignal } from '@preact/signals';
import { isIndex, isWithin, itemIndexIn, keysOf, pathUnder } from '../paths.js';
import { sameValue, valueAt } from './content.js';
import { changeOrigins } from './list-changes.js';

/**
 * A value in a page's content: a Field's text or number, or a List's Items.
 */
export type ContentValue =
  | string
  | number
  | readonly ContentValue[]
  | { readonly [key: string]: ContentValue };

/**
 * One unit of a Draft, as Publish sends it (P3): an edit to the Field at
 * `path`, or to the structure of the List at `path`, which is one Change for
 * the whole List (S7).
 */
export interface Change {
  /** A content path, such as `hero.title`, `plans.1.price` or `plans`. */
  readonly path: string;
  /**
   * The value the Client changed: the one in the content the page was built
   * from when they first made the Change. The Draft keeps it while the
   * Change is recorded again, also after a reload, so the server can tell
   * when a newer Release changed it too: a Conflict (V2).
   */
  readonly before: ContentValue;
  /** The value in the Draft. */
  readonly after: ContentValue;
  /**
   * For a List whose structure changed: which Item of the List as built each
   * Item of `after` is, by its index there, or `null` for an Item added in
   * this Draft. The Draft keeps it with the Change, so a List restored after
   * a reload knows its edited Items too (`changeOrigins`). Publish does not
   * send it.
   */
  readonly origins?: readonly (number | null)[];
}

/**
 * The Changes a Client has made on a page and not published yet. A Change
 * keeps the value before that the Client first changed, whatever `before`
 * it is recorded again with.
 */
export class Draft {
  readonly #changes;

  /** The Changes by path, in the order they were first recorded. */
  readonly changes: ReadonlySignal<ReadonlyMap<string, Change>>;

  /** The Change count the bar shows (P1). */
  readonly count: ReadonlySignal<number>;

  /** A Draft holding `changes`, such as one restored from the browser. */
  constructor(changes: Iterable<Change> = []) {
    this.#changes = signal<ReadonlyMap<string, Change>>(
      new Map([...changes].map((change) => [change.path, change])),
    );
    this.changes = this.#changes;
    this.count = computed(() => this.#changes.value.size);
  }

  /** Records `change`, replacing any Change already recorded at its path. */
  record(change: Change): void {
    const recorded = this.#changes.value.get(change.path);
    this.#changes.value = new Map(this.#changes.value).set(
      change.path,
      recorded === undefined ? change : { ...change, before: recorded.before },
    );
  }

  /**
   * Drops the Change at `path`, if there is one: the Field holds its built
   * value again.
   */
  remove(path: string): void {
    if (!this.#changes.value.has(path)) return;
    const changes = new Map(this.#changes.value);
    changes.delete(path);
    this.#changes.value = changes;
  }

  /**
   * Makes `changes` the Changes at `path` and under it (`path.…`), in place
   * of those recorded there: a List's Changes, which are one for the whole
   * List once its structure changes (S7), else those of its Fields. A path
   * that stays keeps its position, and new ones go last.
   *
   * Each new Change keeps the values before of those it takes the place of
   * (see `keepBefore`).
   */
  replace(path: string, changes: Iterable<Change>): void {
    const replaced = [...this.#changes.value.values()].filter((change) =>
      isWithin(change.path, path),
    );
    const next = new Map(
      [...changes].map((change) => [change.path, keepBefore(change, replaced)]),
    );
    const kept = new Map<string, Change>();
    let same = true;
    for (const [at, change] of this.#changes.value) {
      if (!isWithin(at, path)) {
        kept.set(at, change);
        continue;
      }
      const replacement = next.get(at);
      next.delete(at);
      if (replacement === undefined) {
        same = false;
        continue;
      }
      kept.set(at, replacement);
      same &&= sameChange(change, replacement);
    }
    for (const [at, change] of next) {
      kept.set(at, change);
      same = false;
    }
    if (!same) this.#changes.value = kept;
  }

  /**
   * The value at `path` on a page built from `content`, with this Draft: the
   * `after` of its Change at `path`, or the value at `path` in the `after`
   * of the List Change it is in, else the built one.
   */
  valueAt(path: string, content: unknown): ContentValue | undefined {
    for (const change of this.#changes.value.values()) {
      if (change.path === path) return change.after;
      const under = pathUnder(path, change.path);
      if (under !== undefined) return valueAt(change.after, under);
    }
    return valueAt(content, path);
  }

  /**
   * Whether this Draft changed the Field at `path`, on a page built from
   * `content`: it has a Change, or it is in a List whose structure changed
   * (S7), in an Item that is not one of the List's built Items. A built
   * Item that only moved shows what was published (L7).
   *
   * Items are matched as a List shown from a Draft gets its Items back
   * (`changeOrigins`), so the phone preview tells the same as the page.
   */
  isChanged(path: string, content: unknown): boolean {
    for (const change of this.#changes.value.values()) {
      if (!isWithin(path, change.path)) continue;
      if (path === change.path) return true;
      const built = valueAt(content, change.path);
      const index = itemIndexIn(path, change.path);
      if (
        !Array.isArray(change.after) ||
        !Array.isArray(built) ||
        index === undefined
      ) {
        return true;
      }
      const origin = changeOrigins(built, change)[index];
      return (
        origin === undefined ||
        !sameValue(
          built[origin],
          (change.after as readonly ContentValue[])[index],
        )
      );
    }
    return false;
  }

  /** Drops every Change, and returns them so the page can be put back. */
  discard(): Change[] {
    const dropped = [...this.#changes.value.values()];
    this.#changes.value = new Map();
    return dropped;
  }
}

/**
 * `change` with the value before that the Client first changed, from the
 * Changes it takes the place of: the one at its path, else those under it
 * (a List Change in place of its Fields' Changes), put into its own value
 * before, else the value at its path in one above it (a Field's Change in
 * place of its List's). Parts they do not hold keep `change`'s own.
 */
function keepBefore(change: Change, replaced: readonly Change[]): Change {
  const same = replaced.find((each) => each.path === change.path);
  if (same !== undefined) return { ...change, before: same.before };
  let before = change.before;
  for (const each of replaced) {
    const under = pathUnder(each.path, change.path);
    const above = pathUnder(change.path, each.path);
    if (under !== undefined) {
      before = withValueAt(before, keysOf(under), each.before);
    } else if (above !== undefined) {
      before = valueAt(each.before, above) ?? before;
    }
  }
  return before === change.before ? change : { ...change, before };
}

/** A copy of `value` holding `inner` at `keys`, if it has a value there. */
function withValueAt(
  value: ContentValue,
  keys: readonly string[],
  inner: ContentValue,
): ContentValue {
  const [key, ...rest] = keys;
  if (key === undefined) return inner;
  if (typeof value !== 'object' || !Object.hasOwn(value, key)) return value;
  if (Array.isArray(value)) {
    if (!isIndex(key)) return value;
    const copy: ContentValue[] = [...(value as readonly ContentValue[])];
    copy[Number(key)] = withValueAt(copy[Number(key)]!, rest, inner);
    return copy;
  }
  const object = value as { readonly [key: string]: ContentValue };
  return { ...object, [key]: withValueAt(object[key]!, rest, inner) };
}

function sameChange(a: Change, b: Change): boolean {
  return (
    a.path === b.path &&
    sameValue(a.before, b.before) &&
    sameValue(a.after, b.after)
  );
}
