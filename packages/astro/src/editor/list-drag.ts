// Dragging Items to reorder them (S2): a mouse anywhere in an Item outside
// text, or any pointer on the Item's handle, and the window scrolls while
// the pointer is near its top or bottom. The pointer is captured by the
// List, which never moves: an element that moves loses its capture.
import { signal, type ReadonlySignal } from '@preact/signals';
import { markup, selector } from '../markup.js';
import { dropIndex } from './drop.js';
import type { On } from './edit-view.js';
import { itemsOf, listOf } from './list-elements.js';
import { clickInto } from './selection.js';

const field = selector(markup.field);

/** How far a mouse moves before a press on an Item drags it, in px. */
const dragAfter = 4;

/** How near the window's top or bottom a drag scrolls it, in px. */
const edge = 40;

/** Dragging the page's Items. */
export interface ItemDrag {
  /** The Item being dragged, once it moves. */
  readonly dragged: ReadonlySignal<HTMLElement | undefined>;
  /** Whether a pointer pressed an Item to drag it, moving or not yet. */
  readonly pressed: boolean;
  /**
   * A press on the Item `element`: a mouse drags it once it moves, unless it
   * pressed a Field's text, which it selects.
   */
  press(element: HTMLElement, event: PointerEvent): void;
  /** Starts dragging `element` from its handle, with any pointer. */
  grab(element: HTMLElement, event: PointerEvent): void;
  /** Follows the pointer and ends the drag, through the edit view's `on`. */
  listen(on: On): void;
  /** Puts a dragged Item back where it was. Whether there was a drag. */
  cancel(): boolean;
}

export interface DragOptions {
  /** After a drag dropped `element`, which was at index `from`. */
  dropped(element: HTMLElement, from: number): void;
  /** Items moved on the page while dragging. */
  relayout(): void;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Drag {
  readonly element: HTMLElement;
  readonly list: HTMLElement;
  readonly pointerId: number;
  readonly start: Point;
  /** Where it was, to put it back if the drag is cancelled. */
  readonly next: Node | null;
  readonly index: number;
  /**
   * The Field pressed outside its text: if the pointer does not move, the
   * press was a click into that Field.
   */
  readonly field: HTMLElement | undefined;
  point: Point;
  moving: boolean;
}

/** Lets the Client drag the page's Items. */
export function dragItems({ dropped, relayout }: DragOptions): ItemDrag {
  const dragged = signal<HTMLElement | undefined>(undefined);
  let drag: Drag | undefined;
  /** When the last drag ended, to drop the click it ends with. */
  let droppedAt = -Infinity;
  let scrolling = 0;

  function press(element: HTMLElement, event: PointerEvent): void {
    if (
      drag !== undefined ||
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const target = event.target as Element;
    const pressed = target.closest<HTMLElement>(field) ?? undefined;
    if (pressed && overText(pressed, event.clientX, event.clientY)) return;
    // No text selection, and no native drag of a link or image.
    event.preventDefault();
    begin(element, event, false, pressed);
  }

  function grab(element: HTMLElement, event: PointerEvent): void {
    if (
      drag !== undefined ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }
    event.preventDefault();
    begin(element, event, true, undefined);
  }

  function begin(
    element: HTMLElement,
    event: PointerEvent,
    moving: boolean,
    pressed: HTMLElement | undefined,
  ): void {
    const list = listOf(element);
    const point = { x: event.clientX, y: event.clientY };
    drag = {
      element,
      list,
      pointerId: event.pointerId,
      start: point,
      next: element.nextSibling,
      index: itemsOf(list).indexOf(element),
      field: pressed,
      point,
      moving,
    };
    if (moving) dragged.value = element;
    try {
      list.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured, but its events still
      // reach the document.
    }
  }

  function move(event: PointerEvent): void {
    if (drag === undefined || event.pointerId !== drag.pointerId) return;
    drag.point = { x: event.clientX, y: event.clientY };
    if (!drag.moving) {
      const { x, y } = drag.start;
      if (Math.hypot(drag.point.x - x, drag.point.y - y) < dragAfter) return;
      drag.moving = true;
      dragged.value = drag.element;
    }
    event.preventDefault();
    follow();
    scrollNearEdges();
  }

  /** Moves the dragged Item to where the pointer is. */
  function follow(): void {
    if (drag === undefined) return;
    const { list, element, point } = drag;
    const elements = itemsOf(list);
    const from = elements.indexOf(element);
    const to = dropIndex(
      elements.map((each) => each.getBoundingClientRect()),
      from,
      point,
    );
    if (to === from) return;
    list.insertBefore(
      element,
      to > from ? elements[to]!.nextSibling : elements[to]!,
    );
    relayout();
  }

  function release(event: PointerEvent): void {
    if (drag === undefined || event.pointerId !== drag.pointerId) return;
    const { element, index, moving, field: pressed, point } = drag;
    end();
    if (moving) {
      droppedAt = performance.now();
      dropped(element, index);
    } else if (pressed !== undefined) {
      clickInto(pressed, point);
    }
  }

  function cancel(): boolean {
    if (drag === undefined) return false;
    const { element, list, next, moving } = drag;
    end();
    if (moving) {
      list.insertBefore(element, next);
      relayout();
    }
    return true;
  }

  function end(): void {
    drag = undefined;
    dragged.value = undefined;
    cancelAnimationFrame(scrolling);
    scrolling = 0;
  }

  /** Drops the click that ends a drag, which could follow a link. */
  function swallowClick(event: MouseEvent): void {
    if (performance.now() - droppedAt > 300) return;
    droppedAt = -Infinity;
    event.preventDefault();
    event.stopPropagation();
  }

  /** While a drag is near the top or bottom of the window, scrolls. */
  function scrollNearEdges(): void {
    if (scrolling !== 0) return;
    const step = () => {
      scrolling = 0;
      if (drag === undefined) return;
      const { y } = drag.point;
      const by =
        y < edge
          ? (y - edge) / 2
          : y > innerHeight - edge
            ? (y - innerHeight + edge) / 2
            : 0;
      if (by === 0) return;
      scrollBy(0, by);
      follow();
      scrolling = requestAnimationFrame(step);
    };
    scrolling = requestAnimationFrame(step);
  }

  return {
    dragged,
    get pressed() {
      return drag !== undefined;
    },
    press,
    grab,
    listen(on) {
      on('pointermove', move, true);
      on('pointerup', release, true);
      on('pointercancel', cancel, true);
      on('click', swallowClick, true);
    },
    cancel,
  };
}

/** Whether a point is over the text of `element`, not beside it. */
function overText(element: HTMLElement, x: number, y: number): boolean {
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return true;
      }
    }
  }
  return false;
}
