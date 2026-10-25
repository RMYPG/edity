// Where a dragged Item goes (S2), from where the Items are on the screen,
// apart from the DOM. It works for Items in a column, in a row and in a grid
// that wraps.

/** Where an Item is on the screen, as `getBoundingClientRect()` says. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The index the Item at `from` takes when it is dragged to `point`. It takes
 * the place of the Item under the pointer once the pointer is past that
 * Item's middle, coming from where the dragged Item is: across in a row,
 * down in a column or to another row. Above every Item it goes first, below
 * every Item last, and anywhere else it stays at `from`.
 */
export function dropIndex(
  boxes: readonly Box[],
  from: number,
  point: { readonly x: number; readonly y: number },
): number {
  const dragged = boxes[from];
  if (dragged === undefined || boxes.length < 2) return from;
  if (point.y < Math.min(...boxes.map((box) => box.top))) return 0;
  if (point.y > Math.max(...boxes.map((box) => box.bottom))) {
    return boxes.length - 1;
  }
  const index = boxes.findIndex(
    (box, index) =>
      index !== from &&
      point.x >= box.left &&
      point.x <= box.right &&
      point.y >= box.top &&
      point.y <= box.bottom,
  );
  const target = boxes[index];
  if (target === undefined) return from;
  const later = index > from;
  const past = sameRow(dragged, target)
    ? later === point.x > (target.left + target.right) / 2
    : later === point.y > (target.top + target.bottom) / 2;
  return past ? index : from;
}

/** Whether two Items are side by side: they share most of their height. */
export function sameRow(a: Box, b: Box): boolean {
  const shared = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return shared > Math.min(a.bottom - a.top, b.bottom - b.top) / 2;
}
