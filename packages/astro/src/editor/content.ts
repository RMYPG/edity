// Reading a page's Field definitions and built content by path, comparing
// content values, and the Changes a Field's value makes.
import {
  violations,
  type Definition,
  type ObjectDefinition,
  type Violation,
} from '@edity/core';
import type { PageMarker } from '../editable.js';
import type { Change, ContentValue } from './draft.js';
import { fieldValue, type FieldDefinition } from './values.js';

/**
 * The definition of the Field at `path`, such as `hero.title` or
 * `plans.1.price`, or `undefined` when `path` is a List, a group of Fields or
 * nothing at all. Any index of a List stands for its Items.
 */
export function fieldAt(
  fields: ObjectDefinition,
  path: string,
): FieldDefinition | undefined {
  const definition = definitionAt(fields, path);
  return definition?.kind === 'text' || definition?.kind === 'number'
    ? definition
    : undefined;
}

/**
 * The definition at `path`: a Field's, a List's, an Item's or a group's.
 * Any index of a List stands for its Items.
 */
export function definitionAt(
  fields: ObjectDefinition,
  path: string,
): Definition | undefined {
  let definition: Definition | undefined = fields;
  for (const key of path.split('.')) {
    if (definition?.kind === 'object') {
      definition = Object.hasOwn(definition.shape, key)
        ? definition.shape[key]
        : undefined;
    } else if (definition?.kind === 'list' && /^\d+$/.test(key)) {
      definition = definition.item;
    } else {
      return undefined;
    }
  }
  return definition;
}

/** The value at `path` in a page's content, if it has one. */
export function valueAt(
  content: unknown,
  path: string,
): ContentValue | undefined {
  let value = content;
  for (const key of path.split('.')) {
    if (
      typeof value !== 'object' ||
      value === null ||
      !Object.hasOwn(value, key)
    ) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value as ContentValue;
}

/**
 * Whether two content values are the same: the same text or number, Items
 * in the same order, and Fields with the same keys, in any order.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, index) => sameValue(each, b[index]))
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
        sameValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

/**
 * `path` with every List index as `*`, which stands for the same Field in
 * every Item: `plans.*.price`.
 */
export function pathPattern(path: string): string {
  return path
    .split('.')
    .map((key) => (/^\d+$/.test(key) ? '*' : key))
    .join('.');
}

/**
 * The Change the Field at `path` makes when it holds `after`, with its value
 * in the built content as `before` (P3). `undefined` when it holds that value
 * again, or reads the same: text that differs only in spacing does.
 */
export function fieldChange(
  page: PageMarker,
  path: string,
  after: ContentValue,
): Change | undefined {
  const before = valueAt(page.content, path);
  if (before === undefined || before === after) return undefined;
  const definition = fieldAt(page.fields, path);
  if (
    definition?.kind === 'text' &&
    typeof before === 'string' &&
    fieldValue(definition, before) === after
  ) {
    return undefined;
  }
  return { path, before, after };
}

/**
 * What makes a value one its Field or List cannot hold at all, apart from
 * the Limits of its Fields: no text or no number, text that is not one
 * visible line, or a List with too few or too many Items.
 */
const malformed: ReadonlySet<Violation['rule']> = new Set([
  'type',
  'unknown',
  'oneLine',
  'minItems',
  'maxItems',
]);

/**
 * Whether a Change's `after` is a value its Field or List can hold at all:
 * text that is one visible line, a number, or a List of `min` to `max` Items
 * whose Fields all are. Publish stays disabled until it is. The Fields'
 * Limits are checked apart: only Fields the Draft changed block Publish
 * when over one (L7).
 */
export function isWellFormed(
  fields: ObjectDefinition,
  change: Change,
): boolean {
  const definition = definitionAt(fields, change.path);
  return (
    definition === undefined ||
    definition.kind === 'object' ||
    violations(definition, change.after).every(
      (violation) => !malformed.has(violation.rule),
    )
  );
}
