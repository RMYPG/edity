// Showing a Draft in a document: the page itself, or the phone preview's
// frame (P6). This is the one place that puts the Draft's values into a
// document's elements, so restoring a Draft kept in the browser (ticket 14)
// and the preview show it alike.
import type { Change, ContentValue } from './draft.js';
import type { Fields } from './fields.js';

/**
 * Shows each Change's `after` in `root`, in every element there that shows
 * its path, formatted as the template formats it. Returns the Changes `root`
 * has no element for, such as one to a Field the Site no longer has.
 */
export function showDraft(
  fields: Fields,
  changes: Iterable<Change>,
  root: ParentNode = document,
): Change[] {
  const missing: Change[] = [];
  // TODO(ticket 14): show List Changes too, with ticket 13's code, before
  // the Field Changes, which can be in their Items: build the List's Items
  // in `root` from its own <template> (S3), the preview's included, and
  // connect them only when `root` is the page. Today a List Change is
  // reported missing.
  for (const change of changes) {
    const selector = `[data-edity-field="${CSS.escape(change.path)}"]`;
    if (root.querySelector(selector) === null) missing.push(change);
    else fields.show(change.path, change.after, root);
  }
  return missing;
}

/**
 * The Changes that make a document showing the Draft `shown` show `next`:
 * first each Change `next` dropped, with its `before` as `after`, to put its
 * value back as built, then each Change new to `next` or with another value.
 */
export function draftDelta(
  shown: ReadonlyMap<string, Change>,
  next: ReadonlyMap<string, Change>,
): Change[] {
  const delta: Change[] = [];
  for (const [path, change] of shown) {
    if (!next.has(path)) delta.push({ ...change, after: change.before });
  }
  for (const [path, change] of next) {
    const before = shown.get(path);
    if (before === undefined || !sameValue(before.after, change.after)) {
      delta.push(change);
    }
  }
  return delta;
}

function sameValue(a: ContentValue, b: ContentValue): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
