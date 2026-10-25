// Reading a page's Field definitions and built content by path, and the
// Changes a Field's value makes.
import type { Definition, ObjectDefinition } from '@edity/core';
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
  return definition?.kind === 'text' || definition?.kind === 'number'
    ? definition
    : undefined;
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
 * Whether a Change's `after` is a value its Field can hold at all: text
 * that is not blank, or a number. Publish stays disabled until it is. The
 * Field's Limits are checked apart.
 */
export function isWellFormed(
  fields: ObjectDefinition,
  change: Change,
): boolean {
  const definition = fieldAt(fields, change.path);
  switch (definition?.kind) {
    case 'text':
      return typeof change.after === 'string' && change.after.trim() !== '';
    case 'number':
      return typeof change.after === 'number' && Number.isFinite(change.after);
    default:
      // TODO(ticket 13): a List's Change.
      return true;
  }
}
