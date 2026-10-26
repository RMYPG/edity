// Measuring a Field's text as the page renders it, for line Limits (L2).
// Everything works on the element's own document and window, so it measures
// a same-origin frame's elements too, such as the phone preview's.

/**
 * How many lines `element`'s text takes on the page: the distinct rows of
 * its text's boxes. Counting from the boxes, not from the element's height
 * divided by its line height, is right for inline elements, and for lines
 * that an emoji's fallback font makes taller. An element with no text, or
 * not rendered, takes none.
 */
export function countLines(element: Element): number {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const rows: { middle: number; height: number }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node as Text).data.trim() === '') continue;
    range.selectNodeContents(node);
    for (const box of range.getClientRects()) {
      if (box.width === 0 || box.height === 0) continue;
      const middle = box.top + box.height / 2;
      // Boxes on the same line overlap by more than half a line.
      if (!rows.some((row) => Math.abs(row.middle - middle) < row.height / 2)) {
        rows.push({ middle, height: box.height });
      }
    }
  }
  return rows.length;
}

/**
 * The box around `element`'s text, in its viewport, or around the element
 * when it has none.
 */
export function textBox(element: Element): DOMRect {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const box = range.getBoundingClientRect();
  return box.width === 0 && box.height === 0
    ? element.getBoundingClientRect()
    : box;
}

/**
 * The nearest element from `element` up that has a box of its own, such as
 * a block or an inline block: a `ResizeObserver` on it sees the Field's
 * lines change. On an inline element it reports a size once and never again.
 */
export function blockOf(element: Element): Element {
  const window = element.ownerDocument.defaultView;
  for (
    let each: Element | null = element;
    each !== null;
    each = each.parentElement
  ) {
    const display = window?.getComputedStyle(each).display;
    if (display !== 'inline' && display !== 'contents') return each;
  }
  return element.ownerDocument.documentElement;
}
