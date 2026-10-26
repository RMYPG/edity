// The Editor's text for Lists, in every language it speaks (N6). i18n.ts
// gives it to the Editor as `t.lists`.
import type { Locale } from './i18n.js';

/** Every text the List controls show or give screen readers. */
export interface ListMessages {
  /** What an Item with no text yet is called. */
  item(position: number): string;
  /** The visible text of the button that adds an Item. */
  readonly add: string;
  /** The add button's name, in the List inside the Item `within`, if any. */
  addTo(within: string | undefined): string;
  /** Why no Item can be added. */
  atMost(max: number): string;
  /** Why no Item can be removed. */
  atLeast(min: number): string;
  /** The handle that drags an Item, or moves it with the arrow keys. */
  drag(name: string): string;
  moveUp(name: string): string;
  moveDown(name: string): string;
  remove(name: string): string;
  /** Said once an Item has moved. */
  moved(name: string, position: number, count: number): string;
  /** Said once an Item has been added. */
  added(position: number, count: number): string;
  /** Shown next to Undo once an Item has been removed (S6). */
  removed(name: string): string;
  readonly undo: string;
}

/** `count` and the noun for that many: `1 item`, `3 items`. */
const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export const listMessages: Readonly<Record<Locale, ListMessages>> = {
  es: {
    item: (position) => `elemento ${position}`,
    add: 'Añadir',
    addTo: (within) =>
      within === undefined
        ? 'Añadir elemento'
        : `Añadir elemento a «${within}»`,
    atMost: (max) => `Máximo ${counted(max, 'elemento', 'elementos')}`,
    atLeast: (min) => `Mínimo ${counted(min, 'elemento', 'elementos')}`,
    drag: (name) => `Arrastrar «${name}»`,
    moveUp: (name) => `Subir «${name}»`,
    moveDown: (name) => `Bajar «${name}»`,
    remove: (name) => `Quitar «${name}»`,
    moved: (name, position, count) =>
      `«${name}», posición ${position} de ${count}`,
    added: (position, count) =>
      `Elemento añadido, posición ${position} de ${count}`,
    removed: (name) => `«${name}» quitado`,
    undo: 'Deshacer',
  },
  en: {
    item: (position) => `item ${position}`,
    add: 'Add',
    addTo: (within) =>
      within === undefined ? 'Add item' : `Add item to “${within}”`,
    atMost: (max) => `At most ${counted(max, 'item', 'items')}`,
    atLeast: (min) => `At least ${counted(min, 'item', 'items')}`,
    drag: (name) => `Drag “${name}”`,
    moveUp: (name) => `Move “${name}” up`,
    moveDown: (name) => `Move “${name}” down`,
    remove: (name) => `Remove “${name}”`,
    moved: (name, position, count) =>
      `“${name}”, position ${position} of ${count}`,
    added: (position, count) => `Item added, position ${position} of ${count}`,
    removed: (name) => `“${name}” removed`,
    undo: 'Undo',
  },
};
