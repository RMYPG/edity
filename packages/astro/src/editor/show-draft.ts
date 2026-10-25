// Showing a Draft in a document: the page itself, or the phone preview's
// frame (P6). This is the one place that puts the Draft's values into a
// document's elements, so restoring a Draft kept in the browser (P2),
// Discard and the preview show it alike.
import { batch } from '@preact/signals';
import { markup, selector } from '../markup.js';
import { sameValue, valueAt } from './content.js';
import type { Change, Draft } from './draft.js';
import type { Fields } from './fields.js';
import type { Lists } from './lists.js';

/**
 * Shows each Change's `after` in `root`, in order: a List Change as the
 * List's Items, from its own template in `root` for new ones, and a Field
 * Change in every element there that shows its path, formatted as the
 * template formats it. Nothing becomes editable outside the page, and no
 * Change is recorded. Returns the Changes `root` has no element for, such as
 * one to a Field the Site no longer has.
 */
export function showDraft(
  fields: Fields,
  lists: Lists,
  changes: Iterable<Change>,
  root: ParentNode = document,
): Change[] {
  const missing: Change[] = [];
  // In order: a Change `draftDelta` puts back as built can bring back the
  // Item that a later Change is in.
  batch(() => {
    for (const change of changes) {
      if (!shows(root, change)) {
        missing.push(change);
        continue;
      }
      // Each ignores the other's paths.
      lists.show(change.path, change.after, root);
      fields.show(change.path, change.after, root);
    }
  });
  return missing;
}

/** Whether `root` shows the List or the Field a Change is to. */
function shows(root: ParentNode, { path, after }: Change): boolean {
  const attribute = Array.isArray(after)
    ? markup.list
    : typeof after === 'object'
      ? undefined
      : markup.field;
  return (
    attribute !== undefined &&
    root.querySelector(selector(attribute, path)) !== null
  );
}

/**
 * Shows a Draft restored from the browser on the page (P2), and drops the
 * Changes to Fields and Lists it no longer has. Returns how many it dropped.
 */
export function restoreDraft(
  draft: Draft,
  fields: Fields,
  lists: Lists,
): number {
  const missing = showDraft(fields, lists, draft.changes.peek().values());
  batch(() => {
    for (const { path } of missing) draft.remove(path);
  });
  return missing.length;
}

/**
 * The Changes that make a document showing the Draft `shown` show `next`:
 * first each Change `next` dropped, with its value in `content` (as built)
 * as `after`, then each Change new to `next` or with another value.
 */
export function draftDelta(
  shown: ReadonlyMap<string, Change>,
  next: ReadonlyMap<string, Change>,
  content: unknown,
): Change[] {
  const delta: Change[] = [];
  for (const [path, change] of shown) {
    if (!next.has(path)) delta.push(asBuilt(change, content));
  }
  for (const [path, change] of next) {
    const before = shown.get(path);
    if (before === undefined || !sameValue(before.after, change.after)) {
      delta.push(change);
    }
  }
  return delta;
}

/**
 * `change` with its value in `content` as `after`, to put it back as built.
 * Its `before` can be older: the value it had when the Client first changed
 * it, in an earlier Release.
 */
export function asBuilt(change: Change, content: unknown): Change {
  return { ...change, after: valueAt(content, change.path) ?? change.before };
}
