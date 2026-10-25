// The Changes a List on the page makes (S7), apart from the DOM: one Change
// for the whole List once Items were added, removed or reordered in it, else
// a Change for each of its Items' Fields, and for each List inside them, that
// the Client edited.
import type {
  Definition,
  ListDefinition,
  ObjectDefinition,
  TextDefinition,
} from '@edity/core';
import type { PageMarker } from '../editable.js';
import { childPath } from '../paths.js';
import { definitionAt, fieldChange, sameValue, valueAt } from './content.js';
import type { Change, ContentValue } from './draft.js';

/** A List as the page shows it now. */
export interface ListNow {
  readonly items: readonly ItemNow[];
}

/** An Item as the page shows it now. */
export interface ItemNow {
  /**
   * Its index in the List as built, or `undefined` for an Item added in this
   * Draft. Items keep it wherever they move.
   */
  readonly origin: number | undefined;
  /** Its value now: its text, or its Fields' values and its List's Items. */
  readonly value: ContentValue;
  /** The Lists inside it that the page shows, by key. */
  readonly lists?: { readonly [key: string]: ListNow };
}

/** The definition of the List at `path`, such as `plans.1.features`. */
export function listAt(
  fields: ObjectDefinition,
  path: string,
): ListDefinition | undefined {
  const definition = definitionAt(fields, path);
  return definition?.kind === 'list' ? definition : undefined;
}

/**
 * The Changes the List at `path` makes when the page shows it as `list`,
 * with `before` from the page's built content (P3).
 */
export function listChanges(
  page: PageMarker,
  path: string,
  list: ListNow,
): Change[] {
  const definition = listAt(page.fields, path);
  const before = valueAt(page.content, path);
  if (definition === undefined || !Array.isArray(before)) return [];
  const asBuilt =
    list.items.length === before.length &&
    list.items.every((item, index) => item.origin === index);
  if (!asBuilt) {
    const after = list.items.map((item) => item.value);
    return sameValue(before, after) ? [] : [{ path, before, after }];
  }
  return list.items.flatMap((item, index) =>
    itemChanges(page, definition.item, childPath(path, index), item),
  );
}

function itemChanges(
  page: PageMarker,
  definition: TextDefinition | ObjectDefinition,
  path: string,
  item: ItemNow,
): Change[] {
  if (definition.kind === 'text') return changed(page, path, item.value);
  const value = item.value as { readonly [key: string]: ContentValue };
  return Object.entries(definition.shape).flatMap(([key, field]) => {
    const at = childPath(path, key);
    if (field.kind !== 'list') return changed(page, at, value[key]);
    // A List the template does not show is as built.
    const shown = item.lists?.[key];
    return shown === undefined ? [] : listChanges(page, at, shown);
  });
}

function changed(
  page: PageMarker,
  path: string,
  value: ContentValue | undefined,
): Change[] {
  const change =
    value === undefined ? undefined : fieldChange(page, path, value);
  return change === undefined ? [] : [change];
}

/**
 * Which built Item each Item of `value` is: the first one not taken yet
 * that holds an equal value, or `undefined` for none. A List shown from a
 * value, such as a restored Draft's, gets its Items' places back this way,
 * and so stays one Change when its structure changed.
 */
export function originsOf(
  built: readonly ContentValue[],
  value: readonly ContentValue[],
): (number | undefined)[] {
  const taken = new Set<number>();
  return value.map((item) => {
    const origin = built.findIndex(
      (each, index) => !taken.has(index) && sameValue(each, item),
    );
    if (origin === -1) return undefined;
    taken.add(origin);
    return origin;
  });
}

/**
 * What a new Item holds until the Client fills it in: empty Fields, which a
 * number Field holds as text that is not a number yet, and the fewest Items
 * its List takes.
 */
export function blankValue(definition: Definition): ContentValue {
  switch (definition.kind) {
    case 'text':
    case 'number':
      return '';
    case 'list':
      return Array.from({ length: definition.limits.min }, () =>
        blankValue(definition.item),
      );
    case 'object':
      return Object.fromEntries(
        Object.entries(definition.shape).map(([key, value]) => [
          key,
          blankValue(value),
        ]),
      );
  }
}
