// The Site's List elements as the markup has them (markup.ts): a List's
// element holds its Items, then its <template>, and every path in an Item
// starts with the Item's own.
//
// The page's elements and the phone preview's come from two windows, each
// with its own HTMLElement, so nothing here tells elements apart with
// `instanceof`.
import { markedPath, markup, pathAttributes, selector } from '../markup.js';
import { childPath, rebased } from '../paths.js';

const field = selector(markup.field);

/** A List element's Items, in order. */
export function itemsOf(list: HTMLElement): HTMLElement[] {
  return [...list.children].filter((child) =>
    child.hasAttribute(markup.item),
  ) as HTMLElement[];
}

/** The List element an Item element is in. */
export function listOf(item: HTMLElement): HTMLElement {
  return item.parentElement as HTMLElement;
}

/** The <template> a List's new Items come from (S3). */
export function templateOf(list: HTMLElement): HTMLTemplateElement | undefined {
  return (
    list.querySelector<HTMLTemplateElement>(
      `:scope > template${selector(markup.template)}`,
    ) ?? undefined
  );
}

/** The first Field an Item shows, which may be the Item itself. */
export function firstField(item: HTMLElement): HTMLElement | undefined {
  return item.matches(field)
    ? item
    : (item.querySelector<HTMLElement>(field) ?? undefined);
}

/** Gives every Item of `list` the path of its place. */
export function renumber(list: HTMLElement): void {
  const path = markedPath(list, markup.list);
  itemsOf(list).forEach((element, index) => {
    const from = markedPath(element, markup.item);
    const to = childPath(path, index);
    if (from !== to) rewrite(element, from, to);
  });
}

/**
 * Rewrites every path in `root` that is `from` or starts with it, templates
 * included, to start with `to` instead.
 */
function rewrite(root: Element | DocumentFragment, from: string, to: string) {
  const elements =
    root.nodeType === Node.ELEMENT_NODE
      ? [root as Element, ...root.querySelectorAll('*')]
      : [...root.querySelectorAll('*')];
  for (const element of elements) {
    for (const name of pathAttributes) {
      const value = element.getAttribute(name);
      const moved = value === null ? undefined : rebased(value, from, to);
      if (moved !== undefined) element.setAttribute(name, moved);
    }
    if (element.localName === 'template') {
      rewrite((element as HTMLTemplateElement).content, from, to);
    }
  }
}
