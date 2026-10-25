import { describe, expect, test } from 'vitest';
import { dropIndex, type Box } from './drop.js';

/** Items one under another, `heights` tall, from y = 0. */
function column(...heights: number[]): Box[] {
  let top = 0;
  return heights.map((height) => {
    const box = { left: 0, right: 300, top, bottom: top + height };
    top += height;
    return box;
  });
}

/** Items side by side, 100 wide with 20 between them, wrapping after `perRow`. */
function grid(count: number, perRow: number): Box[] {
  return Array.from({ length: count }, (_, index) => {
    const left = (index % perRow) * 120;
    const top = Math.floor(index / perRow) * 220;
    return { left, right: left + 100, top, bottom: top + 200 };
  });
}

describe('dropIndex', () => {
  test('in a column, an Item takes the place of the one it is dragged past the middle of', () => {
    const boxes = column(40, 40, 40, 40);

    expect(dropIndex(boxes, 0, { x: 10, y: 50 })).toBe(0);
    expect(dropIndex(boxes, 0, { x: 10, y: 61 })).toBe(1);
    expect(dropIndex(boxes, 0, { x: 10, y: 141 })).toBe(3);
    expect(dropIndex(boxes, 3, { x: 10, y: 99 })).toBe(2);
    expect(dropIndex(boxes, 3, { x: 10, y: 5 })).toBe(0);
  });

  test('it stays put over itself, and once moved it does not swing back', () => {
    // A tall Item and a short one: once the short one is first, the pointer
    // is over the top of the tall one, short of its middle.
    expect(dropIndex(column(100, 20), 1, { x: 10, y: 49 })).toBe(0);
    expect(dropIndex(column(20, 100), 0, { x: 10, y: 49 })).toBe(0);
    expect(dropIndex(column(40, 40), 1, { x: 10, y: 60 })).toBe(1);
  });

  test('above the first Item or below the last, it goes first or last', () => {
    const boxes = column(40, 40, 40);

    expect(dropIndex(boxes, 2, { x: 10, y: -30 })).toBe(0);
    expect(dropIndex(boxes, 0, { x: 10, y: 500 })).toBe(2);
  });

  test('between Items, or beside the List, nothing moves', () => {
    const boxes = grid(3, 3);

    expect(dropIndex(boxes, 0, { x: 110, y: 100 })).toBe(0);
    expect(dropIndex(column(40, 40), 0, { x: 400, y: 70 })).toBe(0);
  });

  test('in a row, it compares across instead of down', () => {
    const boxes = grid(3, 3);

    expect(dropIndex(boxes, 0, { x: 160, y: 20 })).toBe(0);
    expect(dropIndex(boxes, 0, { x: 180, y: 20 })).toBe(1);
    expect(dropIndex(boxes, 0, { x: 300, y: 190 })).toBe(2);
    expect(dropIndex(boxes, 2, { x: 30, y: 100 })).toBe(0);
  });

  test('in a grid that wraps, it compares down to reach another row', () => {
    const boxes = grid(4, 2);

    expect(dropIndex(boxes, 0, { x: 50, y: 300 })).toBe(0);
    expect(dropIndex(boxes, 0, { x: 50, y: 330 })).toBe(2);
    expect(dropIndex(boxes, 3, { x: 50, y: 50 })).toBe(0);
  });

  test('a List of one Item has nowhere to go', () => {
    expect(dropIndex(column(40), 0, { x: 10, y: 400 })).toBe(0);
  });
});
