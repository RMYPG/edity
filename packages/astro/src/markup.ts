// The editable markup: the attributes the template helpers (editable.ts) put
// on a Site's elements for the Editor, and the few the Editor adds itself,
// and the blank Item of a List's <template>. Their names are spelt here, for
// both. CSS files cannot import them, so fields.css, limits.css and
// lists-page.css spell them too.
import type { Definition, NumberLimits } from '@edity/core';

/** The markup's attribute names, by what they mark. */
export const markup = {
  /** On one element of the page: the page marker, as JSON (`PageMarker`). */
  page: 'data-edity-page',
  /** On the element whose whole text is a Field's value: the Field's path. */
  field: 'data-edity-field',
  /** On the element whose children are a List's Items: the List's path. */
  list: 'data-edity-list',
  /** On each Item's root element, a child of its List's: the Item's path. */
  item: 'data-edity-item',
  /** On the <template> of a List's new Items, its last child: the List's path. */
  template: 'data-edity-template',
  /** Set by the Editor on a Field over a Limit: `over` or `warning`. */
  limit: 'data-edity-limit',
  /** Set by the Editor on the phone preview's <iframe>. */
  preview: 'data-edity-preview',
} as const;

/** An attribute that holds a content path. */
export type PathAttribute =
  | typeof markup.field
  | typeof markup.list
  | typeof markup.item
  | typeof markup.template;

/** The attributes that hold a content path, which move with their Item. */
export const pathAttributes: readonly PathAttribute[] = [
  markup.item,
  markup.field,
  markup.list,
  markup.template,
];

/**
 * A CSS selector for the elements that carry `attribute`, or that carry it
 * with `value`, such as a Field's path.
 */
export function selector(attribute: string, value?: string): string {
  return value === undefined
    ? `[${attribute}]`
    : `[${attribute}=${quoted(value)}]`;
}

/** The path `element` is marked with by `attribute`, or `''`. */
export function markedPath(
  element: { getAttribute(name: string): string | null },
  attribute: PathAttribute,
): string {
  return element.getAttribute(attribute) ?? '';
}

/** `value` as a CSS string in double quotes. */
function quoted(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&').replace(/[\n\r\f]/g, (end) => `\\${end.charCodeAt(0).toString(16)} `)}"`;
}

/** What a blank Item holds: text, numbers, and Lists and objects of them. */
export type Blank =
  string | number | readonly Blank[] | { readonly [key: string]: Blank };

/**
 * The value of a blank Item, or of a value in it, for `definition`: empty
 * text Fields, `number(limits)` in each number Field, and the fewest Items
 * each List takes. A List's <template> renders one with every number Field
 * at its minimum, a number the Site's template can format. The Editor holds
 * `''` in them instead, which is no number yet, so that Publish waits until
 * the Client types one.
 */
export function blankValue(
  definition: Definition,
  number: (limits: NumberLimits) => Blank,
): Blank {
  switch (definition.kind) {
    case 'text':
      return '';
    case 'number':
      return number(definition.limits);
    case 'list':
      return Array.from({ length: definition.limits.min }, () =>
        blankValue(definition.item, number),
      );
    case 'object':
      return Object.fromEntries(
        Object.entries(definition.shape).map(([key, value]) => [
          key,
          blankValue(value, number),
        ]),
      );
  }
}
