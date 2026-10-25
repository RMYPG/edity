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
import { definitionAt, fieldChange, valueAt } from './content.js';
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
 * The path of the outermost List that `path` is inside: `plans` for
 * `plans.1.features.0` and for `plans.1.features`. `undefined` for a path
 * outside Lists, such as `hero.title` or `plans` itself.
 */
export function listPathOf(path: string): string | undefined {
  const keys = path.split('.');
  const index = keys.findIndex((key) => /^\d+$/.test(key));
  if (index > 0) return keys.slice(0, index).join('.');
  return undefined;
}

/**
 * The Item a Field at `path` belongs to, and the Field's key in it: `plans.1`
 * and `price` for `plans.1.price`, `services.2` and `''` for `services.2`.
 * `undefined` outside Lists.
 */
export function itemPathOf(
  path: string,
): { readonly item: string; readonly key: string } | undefined {
  const keys = path.split('.');
  const index = keys.findLastIndex((key) => /^\d+$/.test(key));
  if (index < 1) return undefined;
  return {
    item: keys.slice(0, index + 1).join('.'),
    key: keys.slice(index + 1).join('.'),
  };
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
    return equal(before, after) ? [] : [{ path, before, after }];
  }
  return list.items.flatMap((item, index) =>
    itemChanges(page, definition.item, `${path}.${index}`, item),
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
    const at = `${path}.${key}`;
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
      (each, index) => !taken.has(index) && equal(each, item),
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

/** Whether two content values are the same. */
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, index) => equal(each, b[index]))
    );
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(b)
  ) {
    return false;
  }
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        equal(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}
