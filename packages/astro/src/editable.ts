import {
  definitionOf,
  type Definition,
  type FieldDefinitions,
  type ListDefinition,
  type ObjectDefinition,
} from '@edity/core';
import type * as z from 'zod/v4';
import { markup } from './markup.js';

/**
 * The value of a `data-edity-*` attribute: `<h1
 * data-edity-field={home.field('hero.title')}>`. It is `undefined` when the
 * integration is disabled, so Astro leaves the attribute out.
 */
export type Marker = string | undefined;

type Leaf = string | number;

/** The path of every Field outside a List, such as `hero.title`. */
export type FieldPath<T> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? K
    : T[K] extends readonly unknown[]
      ? never
      : `${K}.${FieldPath<T[K]>}`;
}[keyof T & string];

/** The path of every List outside a List, such as `plans`. */
export type ListPath<T> = {
  [K in keyof T & string]: T[K] extends readonly unknown[]
    ? K
    : T[K] extends Leaf
      ? never
      : `${K}.${ListPath<T[K]>}`;
}[keyof T & string];

/** The value at `path` in `T`. */
type At<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? At<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type ItemOf<L> = L extends readonly (infer I)[] ? I : never;

/** The keys of an Item's Fields. */
type FieldKey<I> = {
  [K in keyof I & string]: I[K] extends Leaf ? K : never;
}[keyof I & string];

/** The key of an Item's List. */
type ListKey<I> = {
  [K in keyof I & string]: I[K] extends readonly unknown[] ? K : never;
}[keyof I & string];

/** A page's content, ready to be marked up for the Editor. */
export interface EditablePage<T> {
  /**
   * For `data-edity-page`, on one element of the page, usually `<body>`: the
   * page's name, Field definitions and content, as JSON.
   */
  readonly page: Marker;
  /** For `data-edity-field`: the Field at `path`, outside any List. */
  field(path: FieldPath<T>): Marker;
  /** The List at `path`, outside any List. */
  list<P extends ListPath<T>>(path: P): ListScope<ItemOf<At<T, P>>>;
}

/**
 * A List. Put `data-edity-list={list.path}` on the element that holds its
 * Items, and render the Items inside that element with `<Items of={list}>`.
 */
export interface ListScope<I> {
  /** For `data-edity-list`, on the element whose children are the Items. */
  readonly path: Marker;
  /** The List's Items, in order. */
  readonly items: readonly ItemScope<I>[];
  /**
   * Renders every Item with `renderItem`, then the List's `<template>`, which
   * holds one blank Item rendered the same way. `<Items>` calls it.
   */
  render(
    renderItem: (item: ItemScope<I>) => string | Promise<string>,
  ): Promise<string>;
}

/** An Item of a List, as the function that renders it receives it. */
export type ItemScope<I> = I extends string ? TextItem : ObjectItem<I>;

interface ItemBase<I> {
  /** For `data-edity-item`, on the Item's root element. */
  readonly path: Marker;
  /**
   * The Item's content. In the List's `<template>` it is blank: text Fields
   * are empty, number Fields are 0 or the Limit nearest to it, and Lists hold
   * their minimum number of blank Items.
   */
  readonly value: I;
  /** The Item's position in its List. */
  readonly index: number;
}

/** An Item that is a single text Field, like a bullet. */
export interface TextItem extends ItemBase<string> {
  /** For `data-edity-field`, on the element that shows the Item's text. */
  field(): Marker;
}

/** An Item made of Fields and at most one List. */
export interface ObjectItem<I> extends ItemBase<I> {
  /** For `data-edity-field`: the Item's Field at `key`. */
  field(key: FieldKey<I>): Marker;
  /** The Item's List at `key`. */
  list<K extends ListKey<I>>(key: K): ListScope<ItemOf<I[K]>>;
}

/** The content entry of a page, as `getEntry()` returns it. */
export interface PageEntry<T> {
  /** The page's collection, which names the page. */
  readonly collection: string;
  readonly data: T;
}

/** What `data-edity-page` holds, as JSON. */
export interface PageMarker {
  /** The page's name: the name of its content collection. */
  readonly page: string;
  /** The page's Field definitions, as `definitionOf()` returns them. */
  readonly fields: ObjectDefinition;
  /** The page's content, as built. */
  readonly content: unknown;
  /**
   * The media query of the screens where text Fields' `maxLinesNarrow`
   * applies instead of `maxLines`: the integration's `narrowScreens`.
   */
  readonly narrowScreens: string;
}

/**
 * What the integration tells the template helpers.
 * @internal
 */
export interface HelperOptions {
  /** `false` when the integration is disabled: the helpers mark nothing. */
  readonly enabled: boolean;
  /** The integration's `narrowScreens`, for the page marker. */
  readonly narrowScreens: string;
}

// Replaced with the integration's options by Vite, through `define`.
declare const __EDITY_OPTIONS__: HelperOptions | undefined;

/**
 * Starts marking a page's content up for the Editor, from its Field
 * definitions and its content entry: `const home = editable(homeFields,
 * entry)`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any page's Field definitions
export function editable<D extends FieldDefinitions<any>>(
  fields: D,
  entry: PageEntry<z.output<D>>,
): EditablePage<z.output<D>> {
  if (typeof __EDITY_OPTIONS__ === 'undefined') {
    throw new Error(
      '[edity] The template helpers need the Edity integration: add edity() to `integrations` in astro.config.mjs',
    );
  }
  const root = definitionOf(fields);
  if (root?.kind !== 'object') {
    throw new TypeError(
      '[edity] editable() takes Field definitions made with defineFields()',
    );
  }
  const page: Page = { name: entry.collection, ...__EDITY_OPTIONS__ };
  const marker: PageMarker = {
    page: page.name,
    fields: root,
    content: entry.data,
    narrowScreens: page.narrowScreens,
  };
  const scope: PageScope = {
    page: page.enabled ? JSON.stringify(marker) : undefined,
    field(path) {
      const [definition] = walk(page, root, entry.data, path);
      return field(page, path, definition);
    },
    list(path) {
      const [definition, value] = walk(page, root, entry.data, path);
      return list(page, path, definition, value);
    },
  };
  return scope as unknown as EditablePage<z.output<D>>;
}

// ---------------------------------------------------------------------------
// The untyped scopes behind the typed interfaces above.

interface Page extends HelperOptions {
  readonly name: string;
}

interface PageScope {
  readonly page: Marker;
  field(path: string): Marker;
  list(path: string): AnyList;
}

interface AnyList {
  readonly path: Marker;
  readonly items: readonly AnyItem[];
  render(
    renderItem: (item: AnyItem) => string | Promise<string>,
  ): Promise<string>;
}

interface AnyItem {
  readonly path: Marker;
  readonly value: unknown;
  readonly index: number;
  field(key?: string): Marker;
  list(key: string): AnyList;
}

/** Follows `path` through groups of Fields, from the page's root. */
function walk(
  page: Page,
  root: ObjectDefinition,
  data: unknown,
  path: string,
): [Definition | undefined, unknown] {
  const keys = path.split('.');
  let definition: Definition | undefined = root;
  let value = data;
  for (const [index, key] of keys.entries()) {
    if (definition?.kind === 'list') {
      const list = keys.slice(0, index).join('.');
      throw new Error(
        `[edity] "${path}" is inside the List "${list}" in page "${page.name}": mark it through its Item, with item.field() or item.list() in <Items>`,
      );
    }
    if (definition?.kind !== 'object') return [undefined, undefined];
    definition = shapeAt(definition, key);
    value = (value as Record<string, unknown>)[key];
  }
  return [definition, value];
}

function field(
  page: Page,
  path: string,
  definition: Definition | undefined,
): Marker {
  if (definition?.kind !== 'text' && definition?.kind !== 'number') {
    throw new Error(
      `[edity] Unknown Field path "${path}" in page "${page.name}"`,
    );
  }
  return page.enabled ? path : undefined;
}

function list(
  page: Page,
  path: string,
  definition: Definition | undefined,
  value: unknown,
): AnyList {
  if (definition?.kind !== 'list') {
    throw new Error(
      `[edity] Unknown List path "${path}" in page "${page.name}"`,
    );
  }
  const values = value as readonly unknown[];
  const items = values.map((value, index) =>
    item(page, path, definition, value, index),
  );
  return {
    path: page.enabled ? path : undefined,
    items,
    async render(renderItem) {
      let html = '';
      for (const item of items) {
        html += rooted(page, await renderItem(item), item);
      }
      if (!page.enabled) return html;
      // The blank Item takes the next position, as if it were appended.
      const blank = item(
        page,
        path,
        definition,
        blankValue(definition.item),
        values.length,
      );
      const blankHtml = rooted(page, await renderItem(blank), blank);
      return `${html}<template ${markup.template}="${escape(path)}">${blankHtml}</template>`;
    },
  };
}

function item(
  page: Page,
  listPath: string,
  definition: ListDefinition,
  value: unknown,
  index: number,
): AnyItem {
  const path = `${listPath}.${index}`;
  const shape = definition.item;
  return {
    path: page.enabled ? path : undefined,
    value,
    index,
    field(key) {
      return shape.kind === 'text'
        ? field(page, path, shape)
        : field(page, `${path}.${key}`, shapeAt(shape, key));
    },
    list(key) {
      return list(
        page,
        `${path}.${key}`,
        shape.kind === 'object' ? shapeAt(shape, key) : undefined,
        (value as Record<string, unknown>)[key],
      );
    },
  };
}

function shapeAt(
  definition: ObjectDefinition,
  key: string | undefined,
): Definition | undefined {
  return key !== undefined && Object.hasOwn(definition.shape, key)
    ? definition.shape[key]
    : undefined;
}

// An HTML start tag, with attribute values that may hold `>`.
const startTag =
  /^\s*<[a-zA-Z][^\s/>]*(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/;

/**
 * Checks that the Item's markup starts with the element that carries
 * `data-edity-item`, so the Editor can find, move and remove the whole Item.
 */
function rooted(page: Page, html: string, item: AnyItem): string {
  if (item.path === undefined) return html;
  const start = startTag.exec(html)?.[0] ?? '';
  if (!start.includes(` ${markup.item}="${escape(item.path)}"`)) {
    throw new Error(
      `[edity] The Item "${item.path}" in page "${page.name}" must start with its root element, marked with data-edity-item={item.path}`,
    );
  }
  return html;
}

/** A blank Item: what a new Item holds until the Client fills it in. */
function blankValue(definition: Definition): unknown {
  switch (definition.kind) {
    case 'text':
      return '';
    case 'number':
      return Math.min(
        Math.max(0, definition.limits.min),
        definition.limits.max,
      );
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

/** Escapes an attribute value the way Astro does. */
function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}
