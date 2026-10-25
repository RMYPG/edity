// Editing the Site's own Fields in place (E1 to E8). In the edit view every
// element marked `data-edity-field` becomes a plain-text editable element,
// and every edit is recorded in the Draft as a Change. The visitor view puts
// each element back as the Site built it.
//
// Listeners sit on the document and find the Field from the event's target,
// and paths are read from `data-edity-field` on each event, so Items that
// lists.ts adds, moves or renumbers need nothing but `connect()`.
import type { PageMarker } from '../editable.js';
import { markedPath, markup, selector } from '../markup.js';
import { pathPattern } from '../paths.js';
import { fieldAt, fieldChange, valueAt } from './content.js';
import type { ContentValue } from './draft.js';
import { whileEditing, type On } from './edit-view.js';
import css from './fields.css?inline';
import {
  offsetAtPoint,
  rangeIn,
  select,
  selectionIn,
  type Selected,
} from './selection.js';
import { adoptSheet } from './sheets.js';
import type { EditorState } from './state.js';
import {
  fieldValue,
  isNumberText,
  numberFormat,
  oneLine,
  pastedNumber,
  pastedText,
  type FieldDefinition,
  type NumberFormat,
} from './values.js';

const field = selector(markup.field);

/** A Field whose value on the page has just changed. */
export interface FieldInput {
  /** The Field's path, such as `hero.title` or `plans.1.price`. */
  readonly path: string;
  readonly definition: FieldDefinition;
  /** Its value now, as the Draft records it (see `fieldValue`). */
  readonly value: ContentValue;
  /** Every element that shows it (E7), in document order. */
  readonly elements: readonly HTMLElement[];
  /**
   * Whether `show()` put the value there, such as a Draft's or the built
   * one, rather than the Client: only the Client's own edits make Changes.
   */
  readonly shown: boolean;
}

/** The Site's Fields, as the Editor edits them. */
export interface Fields {
  /**
   * Makes the Fields in `root`, and `root` itself if it is one, editable
   * like the rest, or leaves them as a visitor sees them in the visitor
   * view. Call it after adding elements to the page, such as a new Item.
   */
  connect(root: ParentNode): void;
  /**
   * Shows `value` in every element of `root` that shows the Field at
   * `path`, formatting numbers as the template does. Does nothing for a
   * path that is not a Field, such as a List's. It records no Change, and
   * its input is `shown`.
   */
  show(path: string, value: ContentValue, root?: ParentNode): void;
  /**
   * Calls `listener` whenever a Field's value on the page changes: on every
   * input, paste and Escape, when leaving a Field changes its text, and on
   * `show()`. Returns a function that stops the calls.
   */
  onInput(listener: (input: FieldInput) => void): () => void;
}

/** The attributes the Editor sets on a Field's element while editing. */
const attributes = [
  'contenteditable',
  'enterkeyhint',
  'inputmode',
  'spellcheck',
] as const;

/** A Field's text and selection, to put back. */
interface Typed {
  readonly text: string;
  readonly selection: Selected | undefined;
}

/** Starts editing the page's Fields, for as long as the Editor runs. */
export function editFields(state: EditorState): Fields {
  if (state.page === undefined) {
    return { connect() {}, show() {}, onInput: () => () => {} };
  }
  return editPage(state, state.page);
}

function editPage({ draft, view }: EditorState, page: PageMarker): Fields {
  const listeners = new Set<(input: FieldInput) => void>();
  const formatOf = numberFormats(page);
  /** Editable elements, with the attributes they had before. */
  const editable = new WeakMap<HTMLElement, Map<string, string | null>>();
  /** A focused Field's text when the caret entered it, for Escape (E4). */
  const atFocus = new WeakMap<HTMLElement, string>();
  /** A focused number Field's last text that was a number (E5). */
  const lastNumber = new WeakMap<HTMLElement, Typed>();

  const definitionOf = (element: HTMLElement) =>
    fieldAt(page.fields, markedPath(element, markup.field));

  /** The editable Field an event happened in. */
  function fieldOf(target: EventTarget | null): HTMLElement | undefined {
    if (!(target instanceof Element)) return undefined;
    const element = target.closest<HTMLElement>(field);
    return element !== null && editable.has(element) ? element : undefined;
  }

  function connect(root: ParentNode): void {
    const edit = view.peek() === 'edit';
    for (const element of fieldsIn(root)) {
      if (edit) makeEditable(element);
      else makeStatic(element);
    }
  }

  function makeEditable(element: HTMLElement): void {
    const definition = definitionOf(element);
    if (definition === undefined) return;
    if (!editable.has(element)) {
      editable.set(
        element,
        new Map(attributes.map((name) => [name, element.getAttribute(name)])),
      );
    }
    // Plain text only: the browser pastes, drops and types no markup (E3).
    element.setAttribute('contenteditable', 'plaintext-only');
    // Enter leaves the Field (E4), and phone keyboards can say so.
    element.setAttribute('enterkeyhint', 'done');
    if (definition.kind === 'number') {
      element.setAttribute(
        'inputmode',
        definition.limits.decimals === 0 ? 'numeric' : 'decimal',
      );
      element.setAttribute('spellcheck', 'false');
    }
  }

  function makeStatic(element: HTMLElement): void {
    const before = editable.get(element);
    if (before === undefined) return;
    for (const [name, value] of before) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    editable.delete(element);
  }

  function notify(
    path: string,
    definition: FieldDefinition,
    value: ContentValue,
    elements: readonly HTMLElement[],
    shown = false,
  ): void {
    const input = { path, definition, value, elements, shown };
    for (const listener of listeners) listener(input);
  }

  /** Records what the Client did to `element`'s Field, after any input. */
  function changed(element: HTMLElement): void {
    const path = markedPath(element, markup.field);
    const definition = definitionOf(element);
    if (definition === undefined) return;
    const text = element.textContent ?? '';
    const elements = elementsOf(document, path);
    // Every other place that shows the same value follows (E7).
    for (const other of elements) {
      if (other !== element && other.textContent !== text) {
        other.textContent = text;
      }
    }
    const value = fieldValue(definition, text);
    record(path, value);
    notify(path, definition, value, elements);
  }

  function record(path: string, value: ContentValue): void {
    // A Field in an Item is lists.ts's to record, from `onInput`: it is a
    // Change of its own only while its List's structure is as built (S7).
    if (pathPattern(path) !== path) return;
    if (valueAt(page.content, path) === undefined) return;
    const change = fieldChange(page, path, value);
    if (change === undefined) draft.remove(path);
    else draft.record(change);
  }

  /** Where in its text the editable form of a number Field puts `at`. */
  function editableAt(element: HTMLElement, at: number): number {
    const format = formatOf(markedPath(element, markup.field));
    return format.editable((element.textContent ?? '').slice(0, at)).length;
  }

  function focused(element: HTMLElement): void {
    const definition = definitionOf(element);
    if (definition?.kind === 'number') {
      // Thousands separators would read as decimal separators, so the
      // Client edits `12.000` as `12000` (E5).
      const shown = element.textContent ?? '';
      const text = formatOf(markedPath(element, markup.field)).editable(shown);
      if (text !== shown) {
        const selection = selectionIn(element);
        const [start, end] =
          selection?.map((at) => editableAt(element, at)) ?? [];
        element.textContent = text;
        if (start !== undefined && end !== undefined) {
          select(element, [start, end]);
        }
      }
      if (!lastNumber.has(element)) {
        lastNumber.set(element, { text, selection: selectionIn(element) });
      }
    }
    // Kept when the window gave the focus back: see `blurred`.
    if (!atFocus.has(element)) atFocus.set(element, element.textContent ?? '');
  }

  /**
   * Where a click into a number Field puts the caret in its editable text.
   * Firefox places the caret before the Field takes the focus, so `focused`
   * moves it. Chromium and WebKit place it after, at its offset in the text
   * as shown, which the editable text has shortened.
   */
  let clicked:
    { readonly element: HTMLElement; readonly at: number } | undefined;

  function pressed(event: MouseEvent): void {
    clicked = undefined;
    const element = fieldOf(event.target);
    if (
      element === undefined ||
      element === document.activeElement ||
      definitionOf(element)?.kind !== 'number'
    ) {
      return;
    }
    const at = offsetAtPoint(element, event.clientX, event.clientY);
    if (at !== undefined) clicked = { element, at: editableAt(element, at) };
  }

  function released(): void {
    const caret = clicked;
    clicked = undefined;
    if (caret === undefined || caret.element !== document.activeElement) return;
    const selection = selectionIn(caret.element);
    // Text the Client selected with the mouse stays selected.
    if (selection !== undefined && selection[0] !== selection[1]) return;
    select(caret.element, [caret.at, caret.at]);
  }

  function blurred(element: HTMLElement): void {
    // Only the window lost the focus, perhaps for the Client to copy
    // something: the Field is still theirs, trailing space and all.
    if (element === document.activeElement) return;
    atFocus.delete(element);
    lastNumber.delete(element);
    const path = markedPath(element, markup.field);
    const definition = definitionOf(element);
    if (definition === undefined) return;
    const text = element.textContent ?? '';
    const value = fieldValue(definition, text);
    // Leaving a Field shows its value as the page will: single spaces, and
    // numbers as the template formats them. A number Field that does not
    // hold a number keeps what the Client typed.
    const shown =
      typeof value === 'number'
        ? formatOf(path).format(value)
        : definition.kind === 'text'
          ? String(value)
          : text;
    const elements = elementsOf(document, path);
    let changes = false;
    for (const each of elements) {
      if (each.textContent !== shown) {
        each.textContent = shown;
        changes = true;
      }
    }
    if (changes) notify(path, definition, value, elements);
  }

  /** Called after every input, once any composition has ended. */
  function typed(element: HTMLElement): void {
    flatten(element);
    if (definitionOf(element)?.kind === 'number') {
      const text = element.textContent ?? '';
      const last = lastNumber.get(element);
      // An IME or a dead key can insert what beforeinput could not refuse.
      if (
        !isNumberText(text) &&
        last !== undefined &&
        isNumberText(last.text)
      ) {
        element.textContent = last.text;
        if (last.selection !== undefined) select(element, last.selection);
      } else {
        lastNumber.set(element, { text, selection: selectionIn(element) });
      }
    }
    changed(element);
  }

  function keydown(event: KeyboardEvent): void {
    const element = fieldOf(event.target);
    // Keys that end an IME composition belong to it.
    if (
      element === undefined ||
      event.defaultPrevented ||
      event.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    if (event.key === 'Enter') {
      // Leaves the Field and keeps the edit (E4). In a link or a button it
      // would follow the link or press the button (E6).
      event.preventDefault();
      element.blur();
    } else if (event.key === 'Escape') {
      // Puts back the value the Field had when the caret entered (E4).
      event.preventDefault();
      const text = atFocus.get(element);
      if (text !== undefined && element.textContent !== text) {
        element.textContent = text;
        changed(element);
      }
      element.blur();
    } else if (
      event.key === 'Tab' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      // To the next Field, not to the link or button around it (E8). From
      // the last one, Tab goes on to the Editor's bar.
      const next = fieldNextTo(element, event.shiftKey ? -1 : 1);
      if (next !== undefined) {
        event.preventDefault();
        next.focus();
        select(next, [0, next.textContent?.length ?? 0]);
      }
    }
  }

  function beforeInput(event: InputEvent): void {
    const element = fieldOf(event.target);
    if (element === undefined || event.defaultPrevented) return;
    if (
      event.inputType === 'insertParagraph' ||
      event.inputType === 'insertLineBreak'
    ) {
      // Phone keyboards can send Enter with no usable keydown.
      event.preventDefault();
      element.blur();
      return;
    }
    const definition = definitionOf(element);
    if (definition?.kind !== 'number' || !insertions.has(event.inputType)) {
      return;
    }
    const data = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
    if (!fits(element, data, targetOf(element, event))) event.preventDefault();
  }

  function paste(event: ClipboardEvent): void {
    const element = fieldOf(event.target);
    if (element === undefined || event.defaultPrevented) return;
    // Only the text, on one line (E3). Browsers paste line breaks even into
    // plain-text elements.
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text/plain') ?? '';
    const definition = definitionOf(element);
    let text = pastedText(pasted);
    if (definition?.kind === 'number') {
      const selection = selectionIn(element);
      const number = pastedNumber(pasted, definition.limits.decimals);
      const digits = number.replace(/[.,]/g, '');
      text = fits(element, number, selection)
        ? number
        : fits(element, digits, selection)
          ? digits
          : '';
    }
    // Inserted as typing is, so the browser's undo still works.
    if (text !== '') document.execCommand('insertText', false, text);
  }

  /** Stops links and buttons that hold a Field from acting on clicks (E6). */
  function guard(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>(
      'a[href], area[href], button, label, summary',
    );
    if (
      control !== null &&
      (editable.has(control) ||
        [...control.querySelectorAll<HTMLElement>(field)].some((each) =>
          editable.has(each),
        ))
    ) {
      // Chromium also fires a click on the button when a Space is typed in
      // a Field inside it.
      event.preventDefault();
    }
  }

  /** The editable, rendered Field `step` places from `element`. */
  function fieldNextTo(
    element: HTMLElement,
    step: number,
  ): HTMLElement | undefined {
    const all = [...document.querySelectorAll<HTMLElement>(field)].filter(
      (each) => editable.has(each) && each.getClientRects().length > 0,
    );
    const at = all.indexOf(element);
    return at === -1 ? undefined : all[at + step];
  }

  function start(on: On): () => void {
    const forField =
      (handle: (element: HTMLElement) => void) => (event: Event) => {
        const element = fieldOf(event.target);
        if (element !== undefined) handle(element);
      };

    on('mousedown', pressed);
    on('mouseup', released);
    on('focusin', forField(focused));
    on('focusout', forField(blurred));
    on('keydown', keydown);
    on('beforeinput', beforeInput);
    on('input', (event) => {
      const element = fieldOf(event.target);
      if (element === undefined) return;
      // Changing the text while an IME composes would break it: wait for
      // compositionend. Text Fields still follow along.
      if (!(event as InputEvent).isComposing) typed(element);
      else if (definitionOf(element)?.kind === 'text') changed(element);
    });
    on('compositionend', forField(typed));
    on('paste', paste);
    on('click', guard, true);
    // A middle click would open the link in a new tab.
    on('auxclick', guard, true);

    const removeSheet = adoptSheet(document, css);
    connect(document);

    return () => {
      // Leaving a Field commits it, while the listeners still run.
      const active = fieldOf(document.activeElement);
      active?.blur();
      removeSheet();
      connect(document);
    };
  }

  // The visitor view (P7) leaves the page as a visitor sees it.
  whileEditing(view, start);

  return {
    connect,
    show(path, value, root = document) {
      const definition = fieldAt(page.fields, path);
      if (definition === undefined) return;
      const text =
        typeof value === 'number' && definition.kind === 'number'
          ? formatOf(path).format(value)
          : String(value);
      const elements = elementsOf(root, path);
      for (const element of elements) {
        if (element.textContent !== text) element.textContent = text;
      }
      if (elements.length > 0) notify(path, definition, value, elements, true);
    },
    onInput(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Input types that insert text, which a number Field filters (E5). */
const insertions = new Set([
  'insertText',
  'insertReplacementText',
  'insertFromDrop',
  'insertFromPaste',
  'insertFromYank',
]);

/** Whether `element`'s number text stays one with `data` at `selection`. */
function fits(
  element: HTMLElement,
  data: string,
  selection: Selected | undefined,
): boolean {
  const text = element.textContent ?? '';
  const [start, end] = selection ?? [text.length, text.length];
  return isNumberText(text.slice(0, start) + data + text.slice(end));
}

/**
 * Puts what a browser may have inserted back on one line in one text node,
 * keeping the caret: a line break from a drop, or markup. A lone `<br>` is
 * what Firefox and WebKit keep in an empty Field, and it reads as no text.
 */
function flatten(element: HTMLElement): void {
  const nodes = [...element.childNodes];
  const text = element.textContent ?? '';
  const plain =
    nodes.every((node) => node instanceof Text) ||
    (nodes.length === 1 && nodes[0] instanceof HTMLBRElement);
  if (plain && oneLine(text) === text) return;
  const selection = selectionIn(element);
  element.textContent = oneLine(textOf(element));
  if (selection !== undefined) select(element, selection);
}

/** `element`'s text, with a space for each `<br>` that ends a line. */
function textOf(element: HTMLElement): string {
  let text = '';
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text) text += node.data;
    // A last <br> shows no empty line after it.
    else if (node instanceof HTMLBRElement && node !== element.lastChild) {
      text += ' ';
    }
  }
  return text;
}

/** The Fields in `root`, and `root` itself if it is one. */
function fieldsIn(root: ParentNode): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(field)];
  return root instanceof HTMLElement && root.matches(field)
    ? [root, ...all]
    : all;
}

/** Every element of `root` that shows the Field at `path`. */
function elementsOf(root: ParentNode, path: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector(markup.field, path))];
}

/**
 * How the template formats each number Field, found from the page as built.
 * Every Item of a List formats its Field alike, so a new Item formats like
 * the others.
 */
function numberFormats(page: PageMarker): (path: string) => NumberFormat {
  const found = new Map<string, NumberFormat>();
  for (const element of document.querySelectorAll<HTMLElement>(field)) {
    const path = markedPath(element, markup.field);
    const pattern = pathPattern(path);
    const value = valueAt(page.content, path);
    if (
      found.has(pattern) ||
      fieldAt(page.fields, path)?.kind !== 'number' ||
      typeof value !== 'number'
    ) {
      continue;
    }
    const locale = element.closest('[lang]')?.getAttribute('lang') || undefined;
    found.set(
      pattern,
      numberFormat(locale, { text: element.textContent ?? '', value }),
    );
  }
  return (path) => {
    const pattern = pathPattern(path);
    let format = found.get(pattern);
    if (format === undefined) {
      format = numberFormat(
        document.documentElement.lang || undefined,
        undefined,
      );
      found.set(pattern, format);
    }
    return format;
  };
}

/** The range an input event is about to change, or the selection. */
function targetOf(
  element: HTMLElement,
  event: InputEvent,
): Selected | undefined {
  const [range] = event.getTargetRanges();
  return (range && rangeIn(element, range)) ?? selectionIn(element);
}
