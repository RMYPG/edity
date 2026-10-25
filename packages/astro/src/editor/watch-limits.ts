// Showing Limits as the Client types (L1 to L7). Every Field element of a
// watched document is checked against its Limits: its value's visible
// characters or number range, and its text's lines as rendered there. A
// Field the Draft changed that breaks one turns red and disables Publish
// (L3); one that broke it as published gets a warning (L7). Nothing here
// ever blocks typing.
//
// The page is watched from the start. Ticket 15's phone preview can watch its
// frame's document too: its lines are measured there, at its own width,
// with its own media queries, fonts and resize events (L6).
import {
  effect,
  signal,
  untracked,
  type ReadonlySignal,
} from '@preact/signals';
import type { PageMarker } from '../editable.js';
import { fieldAt, valueAt } from './content.js';
import type { ContentValue } from './draft.js';
import type { Fields } from './fields.js';
import {
  isChanged,
  limitCounts,
  lineLimit,
  standing,
  type Count,
  type Standing,
} from './limits.js';
import css from './limits.css?inline';
import { blockOf, countLines, textBox } from './lines.js';
import type { EditorState } from './state.js';
import { fieldValue, type FieldDefinition } from './values.js';

const field = '[data-edity-field]';

/** A Field element whose counter shows. */
export interface LimitMark {
  readonly element: HTMLElement;
  readonly path: string;
  /** Never `within`; `near` only for the focused Field. */
  readonly standing: Exclude<Standing, 'within'>;
  /** What its counter shows: the Limits it is near or over, over first. */
  readonly counts: readonly Count[];
  /**
   * Where its counter goes: the element's top and bottom, and its text's
   * left and right, in CSS px from the top left of its document, so the
   * counter scrolls with it. `undefined` when it is not rendered.
   */
  readonly box: Box | undefined;
}

export interface Box {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** The Limits of the Fields on the page, as the Client edits them. */
export interface Limits {
  /** The Field elements whose counter shows, in every watched document. */
  readonly marks: ReadonlySignal<readonly LimitMark[]>;
  /**
   * Also checks the Fields of `document`, such as the phone preview's frame
   * (ticket 15), with lines measured there: its Fields turn red, or get a
   * warning, and a changed one over a Limit disables Publish. Returns a
   * function that stops it. The page's own document is watched already.
   */
  watch(document: Document): () => void;
}

/** One watched document. */
interface Watcher {
  /** Its Field elements whose counter shows, as last checked. */
  readonly marks: readonly LimitMark[];
  /** Starts checking, in the edit view. */
  start(): void;
  /** Stops checking, and leaves its Fields as the Site built them. */
  stop(): void;
  /** Checks its Fields again, in the next frame. */
  schedule(): void;
}

/** Starts showing the Limits of the page's Fields, for as long as it runs. */
export function watchLimits(state: EditorState, fields: Fields): Limits {
  if (state.page === undefined) {
    return { marks: signal([]), watch: () => () => {} };
  }
  return watchPage(state, state.page, fields);
}

function watchPage(
  state: EditorState,
  page: PageMarker,
  fields: Fields,
): Limits {
  const marks = signal<readonly LimitMark[]>([]);
  const watchers = new Map<Document, Watcher>();
  const scheduleAll = () => {
    for (const watcher of watchers.values()) watcher.schedule();
  };
  const update = (checked: boolean) => {
    const all = [...watchers.values()].flatMap((watcher) => watcher.marks);
    if (!sameMarks(marks.peek(), all)) marks.value = all;
    // Stopping in the visitor view keeps Publish as it was until the next
    // check, which comes as soon as the edit view is back.
    if (checked) {
      state.overLimit.value = all.some((mark) => mark.standing === 'over');
    }
  };

  function watch(document: Document): () => void {
    if (watchers.has(document)) return () => {};
    const watcher = watchDocument(document, state, page, update);
    watchers.set(document, watcher);
    if (state.view.peek() === 'edit') watcher.start();
    return () => {
      watcher.stop();
      watchers.delete(document);
      update(true);
    };
  }

  // A Field's value changed: its characters, or its lines.
  fields.onInput(scheduleAll);
  // A Field's Change was recorded or dropped: it is red or only warned.
  effect(() => {
    void state.draft.changes.value;
    untracked(scheduleAll);
  });
  // The visitor view (P7) leaves every Field as the Site built it.
  effect(() => {
    if (state.view.value !== 'edit') return;
    untracked(() => {
      for (const watcher of watchers.values()) watcher.start();
    });
    return () =>
      untracked(() => {
        for (const watcher of watchers.values()) watcher.stop();
      });
  });
  watch(document);

  return { marks, watch };
}

function watchDocument(
  document: Document,
  { draft }: EditorState,
  page: PageMarker,
  update: (checked: boolean) => void,
): Watcher {
  let marks: readonly LimitMark[] = [];
  /** Field elements given a red or warned look, with their `aria-invalid`. */
  const marked = new Map<HTMLElement, string | null>();
  /** Each Field element's box for the ResizeObserver, found once. */
  const blocks = new WeakMap<Element, Element>();
  let running:
    | {
        readonly window: Window & typeof globalThis;
        readonly narrow: MediaQueryList;
        readonly resizes: ResizeObserver;
        readonly observed: WeakSet<Element>;
        readonly sheet: CSSStyleSheet;
        readonly listening: AbortController;
        frame: number | undefined;
      }
    | undefined;

  function start(): void {
    const window = document.defaultView;
    if (running !== undefined || window === null) return;
    const listening = new AbortController();
    const options = { signal: listening.signal, passive: true };
    // From the document's own window, which a frame's elements need.
    const sheet = new window.CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const narrow = window.matchMedia(page.narrowScreens);
    // Lines change with the width, and when a font arrives. Safari fires no
    // `loadingdone` and can resolve `fonts.ready` early, but a font that
    // changes a Field's lines resizes the block around it (L6).
    const resizes = new window.ResizeObserver(schedule);
    running = {
      window,
      narrow,
      resizes,
      observed: new WeakSet(),
      sheet,
      listening,
      frame: undefined,
    };
    narrow.addEventListener('change', schedule, options);
    window.addEventListener('resize', schedule, options);
    document.fonts.addEventListener('loadingdone', schedule, options);
    void document.fonts.ready.then(() => {
      if (!listening.signal.aborted) schedule();
    });
    // Near a Limit, only the focused Field's counter shows.
    document.addEventListener('focusin', schedule, options);
    document.addEventListener('focusout', schedule, options);
    // A Field in a fixed header moves on the page as it scrolls.
    document.addEventListener(
      'scroll',
      () => {
        if (marks.length > 0) schedule();
      },
      options,
    );
    // Anything that moves the Fields below, such as an Item added above.
    resizes.observe(document.documentElement);
    schedule();
  }

  function stop(): void {
    if (running === undefined) return;
    const { window, resizes, sheet, listening, frame } = running;
    running = undefined;
    listening.abort();
    resizes.disconnect();
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    for (const element of [...marked.keys()]) look(element, 'within');
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (each) => each !== sheet,
    );
    marks = [];
    update(false);
  }

  function schedule(): void {
    if (running === undefined || running.frame !== undefined) return;
    running.frame = running.window.requestAnimationFrame(check);
  }

  function check(): void {
    if (running === undefined) return;
    running.frame = undefined;
    const { window, resizes, observed } = running;
    const narrow = running.narrow.matches;
    const changes = [...draft.changes.peek().keys()];
    const focused = document.activeElement?.closest(field);
    const next: LimitMark[] = [];
    const seen = new Set<HTMLElement>();
    for (const element of document.querySelectorAll<HTMLElement>(field)) {
      const path = element.dataset.edityField ?? '';
      const definition = fieldAt(page.fields, path);
      if (definition === undefined) continue;
      let block = blocks.get(element);
      if (block === undefined) {
        block = blockOf(element);
        blocks.set(element, block);
      }
      if (!observed.has(block)) {
        observed.add(block);
        resizes.observe(block);
      }
      const value = valueOf(path, definition, element);
      if (value === undefined) continue;
      const counts = limitCounts(
        definition,
        value,
        definition.kind === 'text' &&
          lineLimit(definition.limits, narrow) !== undefined
          ? { lines: countLines(element), narrow }
          : undefined,
      );
      const stands = standing(counts, isChanged(path, changes));
      look(element, stands);
      seen.add(element);
      if (stands === 'within' || (stands === 'near' && element !== focused)) {
        continue;
      }
      next.push({
        element,
        path,
        standing: stands,
        counts,
        box: boxOf(element, window),
      });
    }
    // Fields that went, or are no longer Fields, such as a removed Item.
    for (const element of [...marked.keys()]) {
      if (!seen.has(element)) look(element, 'within');
    }
    marks = next;
    update(true);
  }

  /** The value a Field element shows, as Publish would send it. */
  function valueOf(
    path: string,
    definition: FieldDefinition,
    element: HTMLElement,
  ): ContentValue | undefined {
    // A text Field's element shows its value (E3).
    if (definition.kind === 'text') {
      return fieldValue(definition, element.textContent ?? '');
    }
    // A number Field's shows it as the template formats it, so its value is
    // the Draft's, or the built one.
    for (const change of draft.changes.peek().values()) {
      if (change.path === path) return change.after;
      if (path.startsWith(`${change.path}.`)) {
        return valueAt(change.after, path.slice(change.path.length + 1));
      }
    }
    return valueAt(page.content, path);
  }

  /** Gives a Field element the look of its standing: red, warned or none. */
  function look(element: HTMLElement, stands: Standing): void {
    const limit =
      stands === 'over' || stands === 'warning' ? stands : undefined;
    if (limit === undefined) {
      if (!marked.has(element)) return;
      element.removeAttribute('data-edity-limit');
      restore(element, 'aria-invalid', marked.get(element)!);
      marked.delete(element);
      return;
    }
    if (!marked.has(element)) {
      marked.set(element, element.getAttribute('aria-invalid'));
    }
    if (element.getAttribute('data-edity-limit') !== limit) {
      element.setAttribute('data-edity-limit', limit);
    }
    // Screen readers say a red Field is invalid.
    if (limit === 'over') element.setAttribute('aria-invalid', 'true');
    else restore(element, 'aria-invalid', marked.get(element)!);
  }

  return {
    get marks() {
      return marks;
    },
    start,
    stop,
    schedule,
  };
}

function restore(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/**
 * Where a counter for `element` goes on its page: below the element, which
 * may be a button with padding around its text, and level with its text,
 * which may be centered. `undefined` when it is not rendered.
 */
function boxOf(element: HTMLElement, window: Window): Box | undefined {
  if (element.getClientRects().length === 0) return undefined;
  const { top, bottom } = element.getBoundingClientRect();
  const { right, left } = textBox(element);
  const { scrollX, scrollY } = window;
  return {
    top: top + scrollY,
    right: right + scrollX,
    bottom: bottom + scrollY,
    left: left + scrollX,
  };
}

function sameMarks(
  before: readonly LimitMark[],
  after: readonly LimitMark[],
): boolean {
  return (
    before.length === after.length &&
    before.every((mark, at) => {
      const other = after[at]!;
      return (
        mark.element === other.element &&
        mark.path === other.path &&
        mark.standing === other.standing &&
        JSON.stringify(mark.counts) === JSON.stringify(other.counts) &&
        JSON.stringify(mark.box) === JSON.stringify(other.box)
      );
    })
  );
}
