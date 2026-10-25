import { computed, signal, type ReadonlySignal } from '@preact/signals';

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
  /** The value in the content the page was built from. */
  readonly before: ContentValue;
  /** The value in the Draft. */
  readonly after: ContentValue;
}

/** The Changes a Client has made on a page and not published yet. */
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
    this.#changes.value = new Map(this.#changes.value).set(change.path, change);
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
   */
  replace(path: string, changes: Iterable<Change>): void {
    const next = new Map([...changes].map((change) => [change.path, change]));
    const kept = new Map<string, Change>();
    let same = true;
    for (const [at, change] of this.#changes.value) {
      if (at !== path && !at.startsWith(`${path}.`)) {
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

  /** Drops every Change, and returns them so the page can be put back. */
  discard(): Change[] {
    const dropped = [...this.#changes.value.values()];
    this.#changes.value = new Map();
    return dropped;
  }
}

function sameChange(a: Change, b: Change): boolean {
  return (
    a.path === b.path &&
    JSON.stringify(a.before) === JSON.stringify(b.before) &&
    JSON.stringify(a.after) === JSON.stringify(b.after)
  );
}
