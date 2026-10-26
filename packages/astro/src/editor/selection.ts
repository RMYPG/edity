// The caret and the selection in a Field's element, as offsets into its
// text. Everything goes through the element's own document, which may be a
// frame's.

/** Start and end offsets of a selection in an element's text. */
export type Selected = readonly [number, number];

/** Where the selection is in `element`'s text, if it is inside it. */
export function selectionIn(element: HTMLElement): Selected | undefined {
  const selection = element.ownerDocument.getSelection();
  if (selection === null || selection.rangeCount === 0) return undefined;
  return rangeIn(element, selection.getRangeAt(0));
}

/** Where `range` is in `element`'s text, if it is inside it. */
export function rangeIn(
  element: HTMLElement,
  range: AbstractRange,
): Selected | undefined {
  if (
    !element.contains(range.startContainer) ||
    !element.contains(range.endContainer)
  ) {
    return undefined;
  }
  return [
    offsetIn(element, range.startContainer, range.startOffset),
    offsetIn(element, range.endContainer, range.endOffset),
  ];
}

/** Selects from `start` to `end` in `element`'s text. */
export function select(element: HTMLElement, [start, end]: Selected): void {
  const range = element.ownerDocument.createRange();
  range.setStart(...position(element, start));
  range.setEnd(...position(element, end));
  selectOnly(element.ownerDocument, range);
}

/** Focuses `element` with the caret at its start or end. */
export function caretIn(
  element: HTMLElement | undefined,
  where: 'start' | 'end',
): void {
  if (element === undefined) return;
  element.focus();
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(where === 'start');
  selectOnly(element.ownerDocument, range);
}

/** The offset in `element`'s text nearest to a point in the viewport. */
export function offsetAtPoint(
  element: HTMLElement,
  x: number,
  y: number,
): number | undefined {
  const caret = caretAtPoint(element.ownerDocument, x, y);
  return caret === undefined || !element.contains(caret.node)
    ? undefined
    : offsetIn(element, caret.node, caret.offset);
}

/**
 * What a click at a point would have done: the caret in `element` there, on
 * the line of text nearest to it.
 */
export function clickInto(
  element: HTMLElement,
  point: { readonly x: number; readonly y: number },
): void {
  element.focus();
  const document = element.ownerDocument;
  const caret = caretAtPoint(document, point.x, nearestLine(element, point.y));
  if (caret === undefined || !element.contains(caret.node)) {
    caretIn(element, 'end');
    return;
  }
  const range = document.createRange();
  range.setStart(caret.node, caret.offset);
  selectOnly(document, range);
}

/** Where the caret goes for a point in the viewport of `document`. */
function caretAtPoint(
  document: Document,
  x: number,
  y: number,
): { readonly node: Node; readonly offset: number } | undefined {
  // Safari has only caretRangeFromPoint.
  const position = document.caretPositionFromPoint?.(x, y);
  const range = position ? undefined : document.caretRangeFromPoint?.(x, y);
  const node = position?.offsetNode ?? range?.startContainer;
  const offset = position?.offset ?? range?.startOffset;
  return node === undefined || offset === undefined
    ? undefined
    : { node, offset };
}

/** The middle of the line of `element`'s text nearest to `y`. */
function nearestLine(element: HTMLElement, y: number): number {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  let nearest = y;
  let distance = Infinity;
  for (const rect of range.getClientRects()) {
    const middle = (rect.top + rect.bottom) / 2;
    if (Math.abs(middle - y) < distance) {
      distance = Math.abs(middle - y);
      nearest = middle;
    }
  }
  return nearest;
}

function selectOnly(document: Document, range: Range): void {
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function offsetIn(element: HTMLElement, node: Node, offset: number): number {
  const before = element.ownerDocument.createRange();
  before.setStart(element, 0);
  before.setEnd(node, offset);
  return before.toString().length;
}

function position(element: HTMLElement, offset: number): [Node, number] {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
  );
  let rest = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node as Text).length;
    if (rest <= length) return [node, rest];
    rest -= length;
  }
  return [element, element.childNodes.length];
}
