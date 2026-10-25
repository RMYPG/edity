import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
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
    expect(
      title.safeParse('Fisioterapia y readaptación deportiva').success,
    ).toBe(true);
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

  test('needs at least one visible character', () => {
    const title = text({ maxChars: 10 });

    expect(title.safeParse('').success).toBe(false);
    expect(title.safeParse('   ').success).toBe(false);
    expect(title.safeParse('\t\u00a0\u3000').success).toBe(false);
    expect(title.safeParse(' Hola ').success).toBe(true);
  });

  test.each([
    ['LF', 'Hola\nmundo'],
    ['CR', 'Hola\rmundo'],
    ['CRLF', 'Hola\r\nmundo'],
    ['U+2028', 'Hola\u2028mundo'],
    ['U+2029', 'Hola\u2029mundo'],
  ])('rejects a line break (%s)', (_, value) => {
    expect(text({ maxChars: 20 }).safeParse(value).success).toBe(false);
  });

  test('the rule is a JSON Schema pattern that ECMA-262 and RE2 read alike', () => {
    expect(z.toJSONSchema(text({ maxChars: 10 }))).toMatchObject({
      type: 'string',
      pattern: String.raw`^[\t\v\f\p{Zs}]*[^\t\v\f\p{Zs}\n\r\p{Zl}\p{Zp}][^\n\r\p{Zl}\p{Zp}]*$`,
    });
  });
});
