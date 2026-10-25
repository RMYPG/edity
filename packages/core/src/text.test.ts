import { describe, expect, test } from 'vitest';
import { definitionOf, text } from '@edity/core';

describe('text', () => {
  test('maxChars counts visible characters, so an emoji counts as one', () => {
    // "Fisioterapia 🧑‍⚕️" is 14 visible characters but 18 UTF-16 code units.
    expect(text({ maxChars: 14 }).safeParse('Fisioterapia 🧑‍⚕️').success).toBe(
      true,
    );
    expect(text({ maxChars: 13 }).safeParse('Fisioterapia 🧑‍⚕️').success).toBe(
      false,
    );
  });

  test('line Limits are kept on the definition, not checked when parsing', () => {
    const title = text({ maxChars: 40, maxLines: 1, maxLinesNarrow: 2 });

    expect(definitionOf(title)).toEqual({
      kind: 'text',
      limits: { maxChars: 40, maxLines: 1, maxLinesNarrow: 2 },
    });
    expect(title.safeParse('one\ntwo\nthree\nfour').success).toBe(true);
  });

  test('a letter with a combining accent counts as one', () => {
    // "José" written with "e" and a combining acute accent (U+0301).
    const jose = 'Jose\u0301';

    expect(jose).toHaveLength(5);
    expect(text({ maxChars: 4 }).safeParse(jose).success).toBe(true);
    expect(text({ maxChars: 3 }).safeParse(jose).success).toBe(false);
  });

  test('throws on Limits that are not whole numbers of at least 1', () => {
    expect(() => text({ maxChars: 0 })).toThrow(
      'maxChars must be a whole number of at least 1, got 0',
    );
    expect(() => text({ maxChars: 10, maxLines: 1.5 })).toThrow(
      'maxLines must be a whole number of at least 1, got 1.5',
    );
    expect(() => text({ maxChars: 10, maxLinesNarrow: 0 })).toThrow(
      'maxLinesNarrow must be a whole number of at least 1, got 0',
    );
  });
});
