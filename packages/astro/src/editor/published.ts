// What a Publish changed, against what a page was built from. A Publish's
// commit reaches the page only with its Release, so a page can be built from
// content older than what its Client has published.
import { sameValue, setValueAt, valueAt } from './content.js';
import type { Change } from './draft.js';

/**
 * Those of `published`, in the order they were published, that a page built
 * from `content` does not hold yet: each one whose `before` is still there,
 * once those before it are applied. Once it was built with a Change, or with
 * another value since, the build has caught up, and the Change is dropped.
 */
export function stillToBuild(
  content: unknown,
  published: readonly Change[],
): Change[] {
  const rolling = structuredClone(content);
  return published.filter(({ path, before, after }) => {
    if (!sameValue(valueAt(rolling, path), before)) return false;
    setValueAt(rolling, path, after);
    return true;
  });
}
