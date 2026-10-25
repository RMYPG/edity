import { describe, expect, test } from 'vitest';
import { definitionOf, number } from '@edity/core';

describe('number', () => {
  const price = number({ min: 0, max: 500, decimals: 2 });

  test('accepts values from min to max, inclusive', () => {
    expect(price.safeParse(0).success).toBe(true);
    expect(price.safeParse(500).success).toBe(true);
    expect(price.safeParse(-0.01).success).toBe(false);
    expect(price.safeParse(500.01).success).toBe(false);
  });

  test('accepts at most the given number of decimals', () => {
    expect(price.safeParse(19.99).success).toBe(true);
    expect(price.safeParse(12.5).success).toBe(true);
    expect(price.safeParse(45).success).toBe(true);
    expect(price.safeParse(19.999).success).toBe(false);
    expect(price.safeParse(0.1 + 0.2).success).toBe(false);
  });

  test('with no decimals, accepts whole numbers only', () => {
    const sessions = number({ min: 1, max: 20, decimals: 0 });

    expect(sessions.safeParse(5).success).toBe(true);
    expect(sessions.safeParse(5.5).success).toBe(false);
  });

  test('rejects anything that is not a finite number', () => {
    expect(price.safeParse('45').success).toBe(false);
    expect(price.safeParse(Number.NaN).success).toBe(false);
    expect(price.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  test('keeps its Limits on the definition', () => {
    expect(definitionOf(price)).toEqual({
      kind: 'number',
      limits: { min: 0, max: 500, decimals: 2 },
    });
  });

  test('throws on Limits no value could meet', () => {
    expect(() => number({ min: 10, max: 1, decimals: 0 })).toThrow(
      'min must not be greater than max, got min 10 and max 1',
    );
    expect(() => number({ min: Number.NaN, max: 1, decimals: 0 })).toThrow(
      'min must be a finite number, got NaN',
    );
    expect(() => number({ min: 0, max: 1, decimals: -1 })).toThrow(
      'decimals must be a whole number of at least 0, got -1',
    );
  });
});
