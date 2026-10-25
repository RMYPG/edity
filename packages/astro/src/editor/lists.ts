// Editing the page's Lists in place (S1 to S7): adding, removing and
// reordering Items within each List's bounds, by dragging, with the controls
// that ListControls.tsx shows, and with Enter and Backspace in simple Lists.
//
// The page holds each List's structure: its element's Items, in order, with
// paths renumbered after every edit. Each Item element also keeps the index
// it had as built and its value, which Field edits update, so a List's value
// includes the Fields its template does not show. After every edit, the
// Draft gets the Changes of the outermost List it was in (see
// list-changes.ts): one for the whole List once its structure changed, else
// one for each Field the Client edited in it.
//
// Dragging is in list-drag.ts, the Undo's timing in undo-offer.ts, and what
// the markup makes of a List's elements in list-elements.ts.
import type { ListDefinition } from '@edity/core';
import { batch, computed, signal, type ReadonlySignal } from '@preact/signals';
import type { PageMarker } from '../editable.js';
import { markedPath, markup, selector } from '../markup.js';
import { childPath, itemPathOf, listPathOf } from '../paths.js';
import { valueAt } from './content.js';
import type { ContentValue } from './draft.js';
import { sameRow } from './drop.js';
import { whileEditing, type On } from './edit-view.js';
import type { Fields } from './fields.js';
import { dragItems } from './list-drag.js';
import {
  listAt,
  listChanges,
  newItemValue,
  originsOf,
  type ItemNow,
  type ListNow,
} from './list-changes.js';
import {
  firstField,
  itemsOf,
  listOf,
  renumber,
  templateOf,
} from './list-elements.js';
import css from './lists-page.css?inline';
import { caretIn, selectionIn } from './selection.js';
import { adoptSheet } from './sheets.js';
import type { EditorState } from './state.js';
import { undoOffer } from './undo-offer.js';
import { fieldValue } from './values.js';

const field = selector(markup.field);
const itemSelector = selector(markup.item);
const listSelector = selector(markup.list);

/** The page's Lists, as the Editor edits them. */
export interface Lists {
  /**
   * Shows `value` as the Items of the List at `path` in `root`, such as a
   * List Change's built value on Discard or a restored `after`. An Item that
   * holds a built Item's value is that Item, as built, and the others are
   * new, from the List's template in `root`. Does nothing for a path that is
   * not a List `root` shows.
   *
   * It records no Change. In a document other than the page, such as the
   * phone preview's, the Items stay as a visitor sees them.
   */
  show(path: string, value: ContentValue, root?: ParentNode): void;
  /** What the List controls show, and what they do. */
  readonly controls: ListsUi;
}

/** What ListControls.tsx shows, and what its buttons do. */
export interface ListsUi {
  /** Changes whenever Lists or Items may have moved or changed size. */
  readonly layout: ReadonlySignal<number>;
  /** The Item being dragged, once it moves. */
  readonly dragged: ReadonlySignal<HTMLElement | undefined>;
  /** The Item just removed, while it can be put back (S6). */
  readonly removed: ReadonlySignal<{ readonly name: string } | undefined>;
  /** What to tell screen readers: a new `id` for each message. */
  readonly announcement: ReadonlySignal<{
    readonly text: string;
    readonly id: number;
  }>;
  /** The Lists and the Item whose controls show now. */
  shown(): Shown;
  /** Adds an Item at the end of `list`, and puts the caret in it. */
  add(list: HTMLElement): void;
  /** Moves `item` one place earlier or later. */
  move(item: HTMLElement, step: -1 | 1): void;
  /** Removes `item`, which Undo can put back for a while. */
  remove(item: HTMLElement): void;
  /** Puts back the Item just removed. */
  undo(): void;
  /** Keeps the Undo while the Client points at it or focuses it. */
  keepUndo(keep: boolean): void;
  /** Starts dragging `item` from its handle, with any pointer. */
  grab(item: HTMLElement, event: PointerEvent): void;
}

export interface Shown {
  /** Outermost first: the active Item's outer List, then the Lists in it. */
  readonly lists: readonly ListControl[];
  /** The active Item: the one pointed at, else the one last focused or tapped. */
  readonly item: ItemControl | undefined;
}

export interface ListControl {
  /** Stable for the List element. */
  readonly id: number;
  readonly element: HTMLElement;
  readonly count: number;
  readonly min: number;
  readonly max: number;
  /** The name of the Item the List is in, for a nested List. */
  readonly within: string | undefined;
}

export interface ItemControl {
  /** Stable for the Item element, wherever it moves. */
  readonly id: number;
  readonly element: HTMLElement;
  readonly index: number;
  readonly count: number;
  /** What the Item is called: its first Field's text, or its position. */
  readonly name: string;
  readonly canRemove: boolean;
  /** Whether its List shows Items side by side, so moves go across. */
  readonly across: boolean;
}

/** What the Editor knows of an Item element. */
interface ItemModel {
  readonly id: number;
  /** Its index in its List as built, or `undefined` for a new Item. */
  origin: number | undefined;
  /** Its value now, with the built or blank value of Fields not shown. */
  value: ContentValue;
}

/** What the Editor knows of a List element. */
interface ListModel {
  readonly id: number;
  /** Its Items as built, removed ones included. None for a new Item's List. */
  readonly built: readonly HTMLElement[];
  /** Their values as built. */
  readonly values: readonly ContentValue[];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Removal {
  readonly element: HTMLElement;
  readonly list: HTMLElement;
  readonly index: number;
  readonly name: string;
}

/** Starts editing the page's Lists, for as long as the Editor runs. */
export function editLists(state: EditorState, fields: Fields): Lists {
  if (state.page === undefined) {
    const nothing = signal(undefined);
    return {
      show() {},
      controls: {
        layout: signal(0),
        dragged: nothing,
        removed: nothing,
        announcement: signal({ text: '', id: 0 }),
        shown: () => ({ lists: [], item: undefined }),
        add() {},
        move() {},
        remove() {},
        undo() {},
        keepUndo() {},
        grab() {},
      },
    };
  }
  return editPage(state, state.page, fields);
}

function editPage(
  { draft, view, t }: EditorState,
  page: PageMarker,
  fields: Fields,
): Lists {
  const items = new WeakMap<HTMLElement, ItemModel>();
  const lists = new WeakMap<HTMLElement, ListModel>();
  let ids = 0;

  const layout = signal(0);
  const hovered = signal<HTMLElement | undefined>(undefined);
  const touched = signal<HTMLElement | undefined>(undefined);
  const drags = dragItems({ dropped: moved, relayout });
  const undos = undoOffer<Removal>();
  const announcement = signal({ text: '', id: 0 });
  /** Which of the two changed last, and so wins. */
  const pointed = signal(false);
  const active = computed(
    () =>
      drags.dragged.value ??
      (pointed.value
        ? (hovered.value ?? touched.value)
        : (touched.value ?? hovered.value)),
  );
  /** Makes `element` the active Item, as the Client just focused or tapped it. */
  function touch(element: HTMLElement | undefined): void {
    batch(() => {
      touched.value = element;
      pointed.value = false;
    });
  }

  let frame = 0;
  /** Lets the controls follow, once per frame. */
  function relayout(): void {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      layout.value++;
    });
  }
  const resized = new ResizeObserver(relayout);

  const listDefinition = (list: HTMLElement): ListDefinition | undefined =>
    listAt(page.fields, markedPath(list, markup.list));

  /**
   * Whether `element` is the page's, rather than in a document the Editor
   * only shows the Draft in, such as the phone preview's (ticket 15).
   */
  const onPage = (element: Element) => element.ownerDocument === document;

  /** Documents whose Lists have a model, as they were built. */
  const known = new WeakSet<Document>();
  function registerAll(root: Document): void {
    if (known.has(root)) return;
    known.add(root);
    for (const list of root.querySelectorAll<HTMLElement>(listSelector)) {
      register(list, true);
    }
  }

  /** The Editor's own model of `list` and its Items. */
  function register(list: HTMLElement, built: boolean): void {
    const definition = listDefinition(list);
    if (definition === undefined) return;
    const path = markedPath(list, markup.list);
    const content = valueAt(page.content, path);
    const values = built && Array.isArray(content) ? content : [];
    const elements = itemsOf(list);
    lists.set(list, {
      id: ++ids,
      built: built ? elements : [],
      values,
    });
    if (onPage(list)) resized.observe(list);
    elements.forEach((element, index) => {
      const origin = index < values.length ? index : undefined;
      items.set(element, {
        id: ++ids,
        origin,
        value: structuredClone(
          origin === undefined ? newItemValue(definition.item) : values[index]!,
        ),
      });
      if (onPage(element)) resized.observe(element);
    });
  }

  /** The List element at `path`, if `root` shows it. */
  function listAtPath(
    path: string,
    root: ParentNode = document,
  ): HTMLElement | undefined {
    const list = root.querySelector<HTMLElement>(selector(markup.list, path));
    if (list === null) return undefined;
    // The phone preview's document is as built until the Draft shows there.
    registerAll(list.ownerDocument);
    return lists.has(list) ? list : undefined;
  }

  /** The innermost Item `target` is in, if it is the page's. */
  function itemOf(target: EventTarget | null): HTMLElement | undefined {
    if (!(target instanceof Element)) return undefined;
    const element = target.closest<HTMLElement>(itemSelector);
    return element !== null && items.has(element) ? element : undefined;
  }

  // -------------------------------------------------------------------------
  // The Draft

  function listNow(list: HTMLElement): ListNow {
    const definition = listDefinition(list);
    return {
      items: itemsOf(list).map((element) => itemNow(element, definition)),
    };
  }

  function itemNow(
    element: HTMLElement,
    definition: ListDefinition | undefined,
  ): ItemNow {
    const { origin, value } = items.get(element)!;
    if (definition?.item.kind !== 'object') return { origin, value };
    const now: Record<string, ContentValue> = {
      ...(value as Record<string, ContentValue>),
    };
    const shown: Record<string, ListNow> = {};
    for (const [key, each] of Object.entries(definition.item.shape)) {
      if (each.kind !== 'list') continue;
      const list = nestedList(element, key);
      if (list === undefined) continue;
      shown[key] = listNow(list);
      now[key] = shown[key].items.map((item) => item.value);
    }
    return { origin, value: now, lists: shown };
  }

  function nestedList(
    element: HTMLElement,
    key: string,
  ): HTMLElement | undefined {
    const list = element.querySelector<HTMLElement>(
      selector(markup.list, childPath(markedPath(element, markup.item), key)),
    );
    return list !== null && lists.has(list) ? list : undefined;
  }

  /** Records the Changes of the outermost List that `path` is in, or is. */
  function sync(path: string): void {
    const outer = listPathOf(path) ?? path;
    const list = listAtPath(outer);
    if (list !== undefined) {
      draft.replace(outer, listChanges(page, outer, listNow(list)));
    }
  }

  /** While above 0, Field inputs only update the Items' values. */
  let quiet = 0;
  function quietly(edit: () => void): void {
    quiet++;
    try {
      batch(edit);
    } finally {
      quiet--;
    }
  }

  fields.onInput(({ path, value, elements, shown }) => {
    // The phone preview's frame shows the Draft too (ticket 15): only the
    // page's Items are edited.
    if (elements[0] === undefined || !onPage(elements[0])) return;
    const at = itemPathOf(path);
    const element =
      at && elements[0]?.closest<HTMLElement>(selector(markup.item, at.item));
    const model = element && items.get(element);
    if (at === undefined || !model) return;
    model.value =
      at.key === ''
        ? value
        : { ...(model.value as Record<string, ContentValue>), [at.key]: value };
    if (quiet === 0) {
      // A value shown from a Draft, or as built, is no edit of the Client's.
      if (!shown) sync(path);
      relayout();
    }
  });

  // -------------------------------------------------------------------------
  // Structure

  /** After an edit to `list`'s structure: the Draft, and the controls. */
  function edited(list: HTMLElement): void {
    undos.dismiss();
    sync(markedPath(list, markup.list));
    relayout();
  }

  /** A new Item for `list`, from its template, not in its document yet. */
  function newItem(list: HTMLElement): HTMLElement | undefined {
    const template = templateOf(list);
    if (template === undefined) return undefined;
    const element = list.ownerDocument.importNode(template.content, true)
      .firstElementChild as HTMLElement | null;
    if (element === null) return undefined;
    const definition = listDefinition(list);
    items.set(element, {
      id: ++ids,
      origin: undefined,
      value: definition ? newItemValue(definition.item) : '',
    });
    if (onPage(list)) resized.observe(element);
    for (const nested of element.querySelectorAll<HTMLElement>(listSelector)) {
      register(nested, false);
    }
    return element;
  }

  /** Puts `element` in `list` at `index`, and every path back in order. */
  function place(list: HTMLElement, element: HTMLElement, index: number): void {
    list.insertBefore(
      element,
      itemsOf(list)[index] ?? templateOf(list) ?? null,
    );
    renumber(list);
  }

  /** Shows `value` in the Item `element`: its Fields and its List. */
  function fill(element: HTMLElement, value: ContentValue): void {
    const model = items.get(element);
    const definition = listDefinition(listOf(element));
    if (model === undefined || definition === undefined) return;
    model.value = structuredClone(value);
    const path = markedPath(element, markup.item);
    const root = element.ownerDocument;
    if (definition.item.kind === 'text') {
      fields.show(path, value, root);
      return;
    }
    const values = value as Record<string, ContentValue>;
    for (const [key, each] of Object.entries(definition.item.shape)) {
      const shown = values[key] ?? newItemValue(each);
      if (each.kind !== 'list') {
        fields.show(childPath(path, key), shown, root);
        continue;
      }
      const list = nestedList(element, key);
      if (list !== undefined && Array.isArray(shown)) showList(list, shown);
    }
  }

  function showList(list: HTMLElement, value: readonly ContentValue[]): void {
    const model = lists.get(list);
    const definition = listDefinition(list);
    if (model === undefined || definition === undefined) return;
    const origins = originsOf(model.values, value);
    // New Items on the page are used before new ones from the template.
    const spare = itemsOf(list).filter(
      (element) => items.get(element)?.origin === undefined,
    );
    const shown = origins.map((origin) =>
      origin === undefined
        ? (spare.shift() ?? newItem(list))
        : model.built[origin],
    );
    for (const element of itemsOf(list)) {
      if (!shown.includes(element)) element.remove();
    }
    shown.forEach((element, index) => {
      if (element === undefined) return;
      list.insertBefore(element, templateOf(list) ?? null);
      items.get(element)!.origin = origins[index];
    });
    renumber(list);
    for (const [index, element] of shown.entries()) {
      if (element === undefined) continue;
      // Elsewhere, such as in the phone preview, nothing is editable.
      if (onPage(element)) fields.connect(element);
      fill(element, value[index]!);
    }
  }

  function add(
    list: HTMLElement,
    index: number,
    value?: ContentValue,
  ): HTMLElement | undefined {
    const definition = listDefinition(list);
    if (
      definition === undefined ||
      itemsOf(list).length >= definition.limits.max
    ) {
      return undefined;
    }
    const element = newItem(list);
    if (element === undefined) return undefined;
    quietly(() => {
      place(list, element, index);
      fields.connect(element);
      fill(element, value ?? newItemValue(definition.item));
    });
    edited(list);
    const elements = itemsOf(list);
    announce(t.lists.added(elements.indexOf(element) + 1, elements.length));
    return element;
  }

  function remove(element: HTMLElement): boolean {
    const list = listOf(element);
    const definition = listDefinition(list);
    const elements = itemsOf(list);
    if (definition === undefined || elements.length <= definition.limits.min) {
      return false;
    }
    const name = nameOf(element);
    const index = elements.indexOf(element);
    element.remove();
    renumber(list);
    edited(list);
    undos.offer({ element, list, index, name });
    return true;
  }

  function move(element: HTMLElement, to: number): void {
    const list = listOf(element);
    const elements = itemsOf(list);
    const from = elements.indexOf(element);
    if (to < 0 || to >= elements.length || to === from) return;
    list.insertBefore(
      element,
      to > from ? elements[to]!.nextSibling : elements[to]!,
    );
    moved(element, from);
  }

  /** After `element` moved from `from`, by a button or by dragging. */
  function moved(element: HTMLElement, from: number): void {
    const list = listOf(element);
    const elements = itemsOf(list);
    const to = elements.indexOf(element);
    if (to === from) return;
    renumber(list);
    edited(list);
    announce(t.lists.moved(nameOf(element), to + 1, elements.length));
  }

  // -------------------------------------------------------------------------
  // Undo (S6)

  function undo(): void {
    const removed = undos.take();
    if (removed === undefined) return;
    const { element, list, index } = removed;
    const definition = listDefinition(list);
    if (
      !list.isConnected ||
      definition === undefined ||
      itemsOf(list).length >= definition.limits.max
    ) {
      return;
    }
    place(list, element, index);
    edited(list);
    touch(element);
  }

  // -------------------------------------------------------------------------
  // Enter and Backspace in simple Lists (S4)

  /** The simple List's Item a Field event happened in, if it did. */
  function simpleItemOf(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return undefined;
    const element = target.closest<HTMLElement>(`${field}[contenteditable]`);
    const item = element && itemOf(element);
    if (
      !element ||
      !item ||
      markedPath(item, markup.item) !== markedPath(element, markup.field)
    ) {
      return undefined;
    }
    const list = listOf(item);
    const definition = listDefinition(list);
    if (definition?.item.kind !== 'text') return undefined;
    return { field: element, item, list, definition, text: definition.item };
  }

  /**
   * Enter in a simple List's Item: the text after the caret goes to a new
   * Item below, which takes the caret. At the List's maximum, Enter only
   * leaves the Field, as anywhere else.
   */
  function split(target: EventTarget | null): boolean {
    const found = simpleItemOf(target);
    if (found === undefined) return false;
    const { field: element, item, list, definition, text: kind } = found;
    if (itemsOf(list).length >= definition.limits.max) return false;
    const text = element.textContent ?? '';
    const [start, end] = selectionIn(element) ?? [text.length, text.length];
    const index = itemsOf(list).indexOf(item);
    let added: HTMLElement | undefined;
    batch(() => {
      const path = markedPath(element, markup.field);
      fields.show(path, fieldValue(kind, text.slice(0, start)));
      added = add(list, index + 1, fieldValue(kind, text.slice(end)));
      // Adding records the List's Changes, the shorter Item's included.
      if (added === undefined) sync(path);
    });
    if (added !== undefined) caretIn(firstField(added), 'start');
    return true;
  }

  /**
   * Backspace in an empty Item of a simple List removes it, with the Undo
   * the remove button offers (S6).
   */
  function removeEmpty(target: EventTarget | null): boolean {
    const found = simpleItemOf(target);
    if (found === undefined || (found.field.textContent ?? '') !== '') {
      return false;
    }
    const elements = itemsOf(found.list);
    const index = elements.indexOf(found.item);
    const previous = elements[index - 1];
    const next = elements[index + 1];
    if (!remove(found.item)) return false;
    if (previous !== undefined) caretIn(firstField(previous), 'end');
    else if (next !== undefined) caretIn(firstField(next), 'start');
    return true;
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && drags.cancel()) {
      event.preventDefault();
      return;
    }
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    if (
      (event.key === 'Enter' && split(event.target)) ||
      (event.key === 'Backspace' && removeEmpty(event.target))
    ) {
      // Before fields.ts, which would leave the Field.
      event.preventDefault();
    }
  }

  function beforeInput(event: InputEvent): void {
    // Phone keyboards can send these with no usable keydown.
    if (
      !event.defaultPrevented &&
      ((event.inputType === 'insertParagraph' && split(event.target)) ||
        (event.inputType === 'deleteContentBackward' &&
          removeEmpty(event.target)))
    ) {
      event.preventDefault();
    }
  }

  // -------------------------------------------------------------------------
  // Dragging (S2): see list-drag.ts.

  function press(event: PointerEvent): void {
    if (inEditor(event)) return;
    const element = itemOf(event.target);
    touch(element);
    if (element !== undefined) drags.press(element, event);
  }

  // -------------------------------------------------------------------------
  // Which Item's controls show

  /** Where the pointer last was, to tell its moves from the page's. */
  let pointer: Point = { x: Number.NaN, y: Number.NaN };

  function track(event: PointerEvent): void {
    pointer = { x: event.clientX, y: event.clientY };
  }

  function hover(event: PointerEvent): void {
    const still = event.clientX === pointer.x && event.clientY === pointer.y;
    pointer = { x: event.clientX, y: event.clientY };
    // An Item that moves from under a pointer that stays, such as after a
    // click on its own move button, keeps its controls.
    if (drags.pressed || still || inEditor(event)) return;
    batch(() => {
      hovered.value =
        event.pointerType === 'mouse' ? itemOf(event.target) : undefined;
      pointed.value = true;
    });
  }

  function focusIn(event: FocusEvent): void {
    if (inEditor(event)) return;
    touch(itemOf(event.target));
  }

  function shown(): Shown {
    // The controls measure the page each time it may have changed.
    void layout.value;
    const current = active.value?.isConnected ? active.value : undefined;
    // The active Item's outer List and the Lists in it, and every empty
    // List, which has no Item to make active.
    const around: HTMLElement[] = [];
    if (current !== undefined) {
      let outer = current;
      for (
        let up = itemOf(listOf(outer));
        up !== undefined;
        up = itemOf(listOf(up))
      ) {
        outer = up;
      }
      around.push(
        listOf(outer),
        ...outer.querySelectorAll<HTMLElement>(listSelector),
      );
    }
    for (const list of document.querySelectorAll<HTMLElement>(listSelector)) {
      if (!around.includes(list) && itemsOf(list).length === 0) {
        around.push(list);
      }
    }
    const shownLists = around.flatMap((list) => {
      const model = lists.get(list);
      const definition = listDefinition(list);
      if (model === undefined || definition === undefined) return [];
      const within = itemOf(list.parentElement);
      return [
        {
          id: model.id,
          element: list,
          count: itemsOf(list).length,
          ...definition.limits,
          within: within && nameOf(within),
        },
      ];
    });
    return {
      lists: shownLists,
      item: current === undefined ? undefined : itemControl(current),
    };
  }

  function itemControl(element: HTMLElement): ItemControl | undefined {
    const model = items.get(element);
    const definition = listDefinition(listOf(element));
    if (model === undefined || definition === undefined) return undefined;
    const elements = itemsOf(listOf(element));
    const index = elements.indexOf(element);
    const neighbour = elements[index === 0 ? 1 : index - 1];
    return {
      id: model.id,
      element,
      index,
      count: elements.length,
      name: nameOf(element),
      canRemove: elements.length > definition.limits.min,
      across:
        neighbour !== undefined &&
        sameRow(
          element.getBoundingClientRect(),
          neighbour.getBoundingClientRect(),
        ),
    };
  }

  /** What an Item is called for screen readers: its first Field's text. */
  function nameOf(element: HTMLElement): string {
    const text = (firstField(element)?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const characters = Array.from(text);
    if (characters.length === 0) {
      return t.lists.item(itemsOf(listOf(element)).indexOf(element) + 1);
    }
    return characters.length > 40
      ? `${characters.slice(0, 39).join('')}…`
      : text;
  }

  function announce(text: string): void {
    announcement.value = { text, id: announcement.peek().id + 1 };
  }

  // -------------------------------------------------------------------------

  function start(on: On, signal: AbortSignal): () => void {
    on('pointerover', hover);
    on('pointerdown', press, true);
    on('pointermove', track, true);
    drags.listen(on);
    on('focusin', focusIn);
    // Before fields.ts's listeners, which leave the Field on Enter.
    on('keydown', keydown, true);
    on('beforeinput', beforeInput, true);
    window.addEventListener('resize', relayout, { signal });
    document.fonts.addEventListener('loadingdone', relayout, { signal });
    const removeSheet = adoptSheet(document, css);

    return () => {
      drags.cancel();
      removeSheet();
      hovered.value = undefined;
      touch(undefined);
    };
  }

  registerAll(document);

  // The visitor view (P7) leaves the Lists as a visitor sees them.
  whileEditing(view, start);

  return {
    show(path, value, root = document) {
      const list = listAtPath(path, root);
      if (list === undefined || !Array.isArray(value)) return;
      if (!onPage(list)) {
        batch(() => showList(list, value));
        return;
      }
      undos.dismiss();
      quietly(() => showList(list, value));
      relayout();
    },
    controls: {
      layout,
      dragged: drags.dragged,
      removed: undos.offered,
      announcement,
      shown,
      add(list) {
        const element = add(list, itemsOf(list).length);
        if (element === undefined) return;
        touch(element);
        caretIn(firstField(element), 'start');
      },
      move(element, step) {
        move(element, itemsOf(listOf(element)).indexOf(element) + step);
      },
      remove(element) {
        remove(element);
      },
      undo,
      keepUndo: undos.keep,
      grab: drags.grab,
    },
  };
}

/** Whether an event happened in the Editor's own controls. */
function inEditor(event: Event): boolean {
  return (
    event.target instanceof Element && event.target.localName === 'edity-root'
  );
}
