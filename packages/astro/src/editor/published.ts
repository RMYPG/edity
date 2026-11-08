// What a Publish changed, against what a page was built from. A Publish's
// commit reaches the page only with its Release, so a page can be built from
// content older than what its Client has published.
import { isWithin } from '../paths.js';
import { sameValue, setValueAt, valueAt } from './content.js';
import type { Change } from './draft.js';

/**
 * Those of `published`, in the order they were published, that a page built
 * from `content` does not hold yet: each one whose `before` is still there,
 * once those before it are applied. Once it was built with a Change, or with
 * another value since, the build has caught up, and the Change is dropped,
 * with those before it to the same Field or List. The build holds them too,
 * even if it reads as their `before`: once a List's Items have moved, another
 * Item can read the same at the index of a Field published earlier.
 */
export function stillToBuild<T extends Change>(
  content: unknown,
  published: readonly T[],
): T[] {
  let left = [...published];
  for (;;) {
    const rolling = structuredClone(content);
    const built = left.findIndex(({ path, before, after }) => {
      if (!sameValue(valueAt(rolling, path), before)) return true;
      setValueAt(rolling, path, after);
      return false;
    });
    if (built === -1) return left;
    const { path } = left[built]!;
    left = left.filter(
      (change, index) =>
        index > built || (index < built && !overlap(change.path, path)),
    );
  }
}

/** Whether the paths are the same, or one is inside the other. */
function overlap(a: string, b: string): boolean {
  return isWithin(a, b) || isWithin(b, a);
}
