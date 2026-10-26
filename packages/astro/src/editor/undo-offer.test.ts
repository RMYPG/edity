import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { undoOffer } from './undo-offer.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('an offer goes after a few seconds (S6)', () => {
  const undo = undoOffer<string>();

  undo.offer('Masaje');
  expect(undo.offered.value).toBe('Masaje');
  vi.advanceTimersByTime(5_999);
  expect(undo.offered.value).toBe('Masaje');
  vi.advanceTimersByTime(1);
  expect(undo.offered.value).toBeUndefined();
});

test('an offer kept stays, and goes a few seconds after it is let go', () => {
  const undo = undoOffer<string>();

  undo.offer('Masaje');
  undo.keep(true);
  vi.advanceTimersByTime(60_000);
  expect(undo.offered.value).toBe('Masaje');
  undo.keep(false);
  vi.advanceTimersByTime(6_000);
  expect(undo.offered.value).toBeUndefined();
});

test('taking an offer withdraws it, and a new one takes the place of the last', () => {
  const undo = undoOffer<string>();

  undo.offer('Masaje');
  undo.offer('Pilates');
  expect(undo.take()).toBe('Pilates');
  expect(undo.offered.value).toBeUndefined();
  expect(undo.take()).toBeUndefined();

  undo.offer('Masaje');
  undo.dismiss();
  expect(undo.offered.value).toBeUndefined();
});
