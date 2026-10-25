import * as z from 'zod/v4';
import { graphemeCount } from './graphemes.js';

// ---------------------------------------------------------------------------
// Limits and definitions: plain, JSON-serialisable data read back from a
// schema with `definitionOf`.

export interface TextLimits {
  /** Maximum number of visible characters (grapheme clusters). */
  readonly maxChars: number;
  /** Maximum number of rendered lines. Checked by the Editor, not by Zod. */
  readonly maxLines?: number;
  /** Maximum number of rendered lines on narrow screens. Checked by the Editor, not by Zod. */
  readonly maxLinesNarrow?: number;
}

export interface NumberLimits {
  /** Smallest value allowed, inclusive. */
  readonly min: number;
  /** Largest value allowed, inclusive. */
  readonly max: number;
  /**
   * Maximum number of decimal places. JSON keeps no trailing zeros, so the
   * template formats the value with exactly this many.
   */
  readonly decimals: number;
}

export interface ListLimits {
  /** Fewest Items allowed, inclusive. */
  readonly min: number;
  /** Most Items allowed, inclusive. */
  readonly max: number;
}

export interface TextDefinition {
  readonly kind: 'text';
  readonly limits: TextLimits;
}

export interface NumberDefinition {
  readonly kind: 'number';
  readonly limits: NumberLimits;
}

export interface ListDefinition {
  readonly kind: 'list';
  readonly limits: ListLimits;
  readonly item: TextDefinition | ObjectDefinition;
}

/** An object of Fields and Lists: a page, a group of Fields in it, or an Item. */
export interface ObjectDefinition {
  readonly kind: 'object';
  readonly shape: { readonly [key: string]: Definition };
}

export type Definition =
  TextDefinition | NumberDefinition | ListDefinition | ObjectDefinition;

// A global symbol, so a definition is found even when the schema was made by
// another copy of this module (Astro loads the content config and the
// integration through different module graphs).
const definitionKey = Symbol.for('@edity/core/definition');

function withDefinition<S extends z.ZodType>(
  schema: S,
  definition: Definition,
): S {
  Object.defineProperty(schema, definitionKey, {
    value: Object.freeze(definition),
  });
  return schema;
}

/**
 * Returns the definition an Edity primitive attached to `schema`, or
 * `undefined` if `schema` was not made by one. The definition of a List or an
 * object includes everything inside it, so the definition of a page's Field
 * definitions describes the whole page. Definitions are frozen plain data and
 * survive `JSON.stringify`.
 */
export function definitionOf(schema: unknown): Definition | undefined {
  if (typeof schema !== 'object' || schema === null) return undefined;
  return (schema as { [definitionKey]?: Definition })[definitionKey];
}

// ---------------------------------------------------------------------------
// Schema types. The brand is type-only: it lets TypeScript tell Edity's
// primitives from plain Zod schemas, and Lists that hold a List from Lists
// that don't.

declare const brand: unique symbol;

export interface TextField extends z.ZodString {
  readonly [brand]: { readonly kind: 'text' };
}

export interface NumberField extends z.ZodNumber {
  readonly [brand]: { readonly kind: 'number' };
}

export type Field = TextField | NumberField;

interface ListBrand<I> {
  readonly [brand]: { readonly kind: 'list'; readonly item: I };
}

/** The Fields of an Item in a nested List, which can hold no List itself. */
interface FieldsShape {
  readonly [key: string]: Field;
}

/** A List whose Items hold no List: the only kind of List an Item can hold. */
type ListOfFields = z.ZodType & ListBrand<TextField | FieldsShape>;

/** The Fields of an Item, and at most one nested List. */
interface ItemShape {
  readonly [key: string]: Field | ListOfFields;
}

/** An Item is a single text Field or an object of Fields. */
export type Item = TextField | ItemShape;

type ItemSchema<I> = I extends TextField
  ? I
  : I extends ItemShape
    ? z.ZodObject<{ -readonly [K in keyof I]: I[K] }, z.core.$strict>
    : never;

export interface List<I extends Item = Item>
  extends z.ZodArray<ItemSchema<I>>, ListBrand<I> {}

type ListKeys<S> = {
  [K in keyof S]: S[K] extends ListBrand<unknown> ? K : never;
}[keyof S];

type IsUnion<T, U = T> = [T] extends [never]
  ? false
  : T extends unknown
    ? [U] extends [T]
      ? false
      : true
    : never;

/** Fails type-checking for an Item that holds more than one List. */
type AtMostOneList<I> = I extends ItemShape
  ? true extends IsUnion<ListKeys<I>>
    ? { 'An Item holds at most one List': never }
    : unknown
  : unknown;

type AnyList = z.ZodType & ListBrand<Item>;

/** What a page's Field definitions, or a group of Fields in them, hold. */
interface Shape {
  readonly [key: string]: Field | AnyList | Shape;
}

type ZodShape<S> = {
  -readonly [K in keyof S]: S[K] extends Field | AnyList
    ? S[K]
    : z.ZodObject<ZodShape<S[K]>, z.core.$strict>;
};

/** A page's Field definitions: the Zod schema of its content. */
export interface FieldDefinitions<S extends Shape = Shape> extends z.ZodObject<
  ZodShape<S>,
  z.core.$strict
> {
  readonly [brand]: { readonly kind: 'fields' };
}

/**
 * Any page's Field definitions, whatever Fields and Lists they hold: the type
 * for a parameter that takes them. A bare `FieldDefinitions` describes no
 * particular page, so a page's own Field definitions are not assignable to it.
 */
export type AnyFieldDefinitions = z.ZodType & {
  readonly [brand]: { readonly kind: 'fields' };
};

// ---------------------------------------------------------------------------
// Primitives

/**
 * What every text Field holds: one line with at least one visible character.
 * Blank means `\t`, `\v`, `\f` or a space separator (Unicode Zs), and a line
 * break is `\n`, `\r`, U+2028 or U+2029. Zod emits this as the JSON Schema
 * `pattern`, which ECMA-262 (with the `u` flag) and Go's RE2 read alike, so it
 * avoids `\s` and `\u` escapes, whose meaning differs between the two.
 */
const oneVisibleLine =
  /^[\t\v\f\p{Zs}]*[^\t\v\f\p{Zs}\n\r\p{Zl}\p{Zp}][^\n\r\p{Zl}\p{Zp}]*$/u;

/**
 * A text Field: one line of at most `maxChars` visible characters, with at
 * least one. Its line Limits are kept on its definition for the Editor, which
 * measures the rendered lines.
 */
export function text(limits: TextLimits): TextField {
  const checked: Mutable<TextLimits> = {
    maxChars: wholeNumber('maxChars', limits.maxChars, 1),
  };
  if (limits.maxLines !== undefined) {
    checked.maxLines = wholeNumber('maxLines', limits.maxLines, 1);
  }
  if (limits.maxLinesNarrow !== undefined) {
    checked.maxLinesNarrow = wholeNumber(
      'maxLinesNarrow',
      limits.maxLinesNarrow,
      1,
    );
  }
  const { maxChars } = checked;
  const schema = z
    .string()
    .regex(oneVisibleLine, {
      message:
        'Invalid text: expected one line with at least one visible character',
    })
    .check((ctx) => {
      const count = graphemeCount(ctx.value);
      if (count > maxChars) {
        ctx.issues.push({
          code: 'too_big',
          origin: 'string',
          maximum: maxChars,
          inclusive: true,
          input: ctx.value,
          message: `Too long: expected at most ${maxChars} visible characters, got ${count}`,
        });
      }
    });
  return withDefinition(schema, {
    kind: 'text',
    limits: Object.freeze(checked),
  }) as TextField;
}

/** A number Field, from `min` to `max` with at most `decimals` decimal places. */
export function number(limits: NumberLimits): NumberField {
  const min = finiteNumber('min', limits.min);
  const max = finiteNumber('max', limits.max);
  ordered(min, max);
  const decimals = wholeNumber('decimals', limits.decimals, 0);
  const schema = z
    .number()
    .min(min)
    .max(max)
    .check((ctx) => {
      const places = decimalPlaces(ctx.value);
      if (places > decimals) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message: `Too many decimals: expected at most ${decimals}, got ${places}`,
        });
      }
    });
  return withDefinition(schema, {
    kind: 'number',
    limits: Object.freeze({ min, max, decimals }),
  }) as NumberField;
}

/**
 * Counts the decimal places in the shortest decimal form of `value`, the one
 * JavaScript prints and JSON stores: 19.99 has 2, and 0.1 + 0.2 has 17.
 */
function decimalPlaces(value: number): number {
  const [mantissa = '', exponent = '0'] = String(value).split('e');
  const fraction = mantissa.split('.')[1] ?? '';
  return Math.max(0, fraction.length - Number(exponent));
}

/**
 * A List of `min` to `max` Items. An Item is a single text Field, or an object
 * of Fields that holds at most one List, whose own Items hold no List.
 */
export function list<I extends Item>(
  item: I & AtMostOneList<I>,
  limits: ListLimits,
): List<I> {
  const min = wholeNumber('min', limits.min, 0);
  const max = wholeNumber('max', limits.max, 1);
  ordered(min, max);
  const { schema: itemSchema, definition: itemDefinition } = toItem(item);
  const schema = z.array(itemSchema).min(min).max(max);
  return withDefinition(schema, {
    kind: 'list',
    limits: Object.freeze({ min, max }),
    item: itemDefinition,
  }) as unknown as List<I>;
}

function toItem(item: unknown): {
  schema: z.ZodType;
  definition: TextDefinition | ObjectDefinition;
} {
  const definition = definitionOf(item);
  if (definition?.kind === 'text') {
    return { schema: item as TextField, definition };
  }
  if (definition !== undefined || !isPlainObject(item)) {
    throw new TypeError(
      'An Item is a text Field or an object of Fields and at most one List',
    );
  }
  const shape: Record<string, Definition> = {};
  const lists: string[] = [];
  for (const [key, value] of Object.entries(item)) {
    const field = definitionOf(value);
    if (field === undefined || field.kind === 'object') {
      throw new TypeError(
        `"${key}" in an Item must be a Field or a List made with text(), number() or list()`,
      );
    }
    if (field.kind === 'list') {
      lists.push(key);
      const nested = listKeys(field.item)[0];
      if (nested !== undefined) {
        throw new TypeError(
          `Lists nest one level deep at most, but the List at "${key}" has Items that hold a List at "${nested}"`,
        );
      }
    }
    shape[key] = field;
  }
  if (lists.length > 1) {
    throw new TypeError(
      `An Item holds at most one List, but this one holds ${lists.length}: ${lists.map((key) => `"${key}"`).join(', ')}`,
    );
  }
  const objectDefinition: ObjectDefinition = {
    kind: 'object',
    shape: Object.freeze(shape),
  };
  return {
    schema: withDefinition(
      z.strictObject(item as Record<string, z.ZodType>),
      objectDefinition,
    ),
    definition: objectDefinition,
  };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function wholeNumber(name: string, value: number, least: number): number {
  if (!Number.isInteger(value) || value < least) {
    throw new RangeError(
      `${name} must be a whole number of at least ${least}, got ${value}`,
    );
  }
  return value;
}

function finiteNumber(name: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${value}`);
  }
  return value;
}

function ordered(min: number, max: number): void {
  if (min > max) {
    throw new RangeError(
      `min must not be greater than max, got min ${min} and max ${max}`,
    );
  }
}

function listKeys(definition: Definition): string[] {
  if (definition.kind !== 'object') return [];
  return Object.entries(definition.shape)
    .filter(([, value]) => value.kind === 'list')
    .map(([key]) => key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Defines a page's Fields and Lists. Plain objects group Fields under a common
 * path, such as `hero.title`.
 */
export function defineFields<S extends Shape>(shape: S): FieldDefinitions<S> {
  return toObject(shape, '') as unknown as FieldDefinitions<S>;
}

function toObject(shape: Record<string, unknown>, path: string): z.ZodType {
  const schemas: Record<string, z.ZodType> = {};
  const definitions: Record<string, Definition> = {};
  for (const [key, value] of Object.entries(shape)) {
    const at = path === '' ? key : `${path}.${key}`;
    const definition = definitionOf(value);
    let schema: z.ZodType;
    if (definition !== undefined && definition.kind !== 'object') {
      schema = value as z.ZodType;
    } else if (definition === undefined && isPlainObject(value)) {
      schema = toObject(value, at);
    } else {
      throw new TypeError(
        `"${at}" must be a Field, a List or an object of them, made with text(), number() and list()`,
      );
    }
    schemas[key] = schema;
    definitions[key] = definitionOf(schema)!;
  }
  return withDefinition(z.strictObject(schemas), {
    kind: 'object',
    shape: Object.freeze(definitions),
  });
}
