// Marking on the page what the server refused of a Publish (V1, V2): Fields
// and Lists it said no to. A mark stays until the Client changes what it is
// on, like the Draft that keeps it.
import { markup, selector } from '../markup.js';
import { sameValue } from './content.js';
import type { ContentValue } from './draft.js';

/** What a Field or List holds now, by its path. */
type ValueNow = (path: string) => ContentValue | undefined;

/** A path's mark. */
interface Mark {
  /** Its elements, with the `aria-invalid` each had. */
  readonly elements: ReadonlyMap<HTMLElement, string | null>;
  /** The value the server refused. */
  readonly value: ContentValue | undefined;
}

/** The marks on one document's Fields and Lists. */
export interface RejectedMarks {
  /**
   * Marks every element that shows a path of `paths`. Returns whether each
   * of them shows on the page, so the Client can correct it.
   */
  mark(paths: readonly string[], valueNow: ValueNow): boolean;
  /** Takes off the marks of the paths whose value has changed. */
  update(valueNow: ValueNow): void;
  clear(): void;
}

export function rejectedMarks(document: Document): RejectedMarks {
  const marks = new Map<string, Mark>();

  function unmark(path: string, { elements }: Mark): void {
    for (const [element, invalid] of elements) {
      element.removeAttribute(markup.rejected);
      if (!element.hasAttribute(markup.field)) continue;
      if (invalid === null) element.removeAttribute('aria-invalid');
      else element.setAttribute('aria-invalid', invalid);
    }
    marks.delete(path);
  }

  return {
    mark(paths, valueNow) {
      let shown = true;
      for (const path of paths) {
        const found = document.querySelectorAll<HTMLElement>(
          [markup.field, markup.list, markup.item]
            .map((attribute) => selector(attribute, path))
            .join(','),
        );
        if (found.length === 0) shown = false;
        const elements = new Map<HTMLElement, string | null>();
        for (const element of found) {
          elements.set(element, element.getAttribute('aria-invalid'));
          element.setAttribute(markup.rejected, '');
          // Screen readers say a refused Field is invalid, as they do one
          // over a Limit.
          if (element.hasAttribute(markup.field)) {
            element.setAttribute('aria-invalid', 'true');
          }
        }
        marks.set(path, { elements, value: valueNow(path) });
      }
      return shown;
    },
    update(valueNow) {
      for (const [path, mark] of marks) {
        if (!sameValue(valueNow(path), mark.value)) unmark(path, mark);
      }
    },
    clear() {
      for (const [path, mark] of marks) unmark(path, mark);
    },
  };
}
