// What a Field's text on the page stands for, and back: the rules for plain
// text (E3) and numbers (E5), apart from the DOM.
import {
  decimalPlaces,
  type NumberDefinition,
  type TextDefinition,
} from '@edity/core';
import type { ContentValue } from './draft.js';

/** The definition of one Field: a text or a number. */
export type FieldDefinition = TextDefinition | NumberDefinition;

/**
 * The value a Field's text on the page stands for, as the Draft records it.
 *
 * - Text: one line with single spaces and none at the ends (E3). The
 *   non-breaking spaces browsers type become plain ones, so a Field the
 *   Client edits also loses any the content had on purpose.
 * - Number: the number, read with a comma or a dot as the decimal separator
 *   (E5). Text that is not a number with at most the Field's decimals is
 *   kept as text, which is never a valid number, so a Client in Spain who
 *   types `13.000` for thirteen thousand is never read as meaning 13.
 */
export function fieldValue(
  definition: FieldDefinition,
  text: string,
): ContentValue {
  if (definition.kind === 'text') return text.replace(/\s+/g, ' ').trim();
  return numberValue(text, definition.limits.decimals) ?? text;
}

/**
 * The number `text` stands for, if it has digits, at most one comma or dot
 * and at most `decimals` digits after it.
 */
export function numberValue(
  text: string,
  decimals: number,
): number | undefined {
  const match = /^(\d*)(?:[.,](\d*))?$/.exec(text);
  if (match === null || !/\d/.test(text)) return undefined;
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > decimals) return undefined;
  return Number(`${whole || '0'}.${fraction || '0'}`);
}

/**
 * Whether a number Field may hold `text` while the Client types: digits and
 * at most one comma or dot (E5). Typing anything else is refused.
 */
export function isNumberText(text: string): boolean {
  return /^\d*([.,]\d*)?$/.test(text);
}

const lineBreak = /[\n\r\u2028\u2029]/g;

/**
 * `text` with each line break turned into a space, one for one, so offsets
 * into it still hold.
 */
export function oneLine(text: string): string {
  return text.replace(lineBreak, ' ');
}

/** What to insert in a text Field for pasted `text`: one line (E3). */
export function pastedText(text: string): string {
  return text
    .replace(/^[\n\r\u2028\u2029]+|[\n\r\u2028\u2029]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * What to insert in a number Field for pasted `text`: its digits and decimal
 * separator, without thousands separators, currency or spaces. One separator
 * before exactly three digits is read as thousands when the Field has fewer
 * decimals than that.
 */
export function pastedNumber(text: string, decimals: number): string {
  const kept = text.replace(/[^\d.,]/g, '');
  const separators = kept.match(/[.,]/g) ?? [];
  const last = separators.at(-1);
  if (last === undefined) return kept;
  const at = kept.lastIndexOf(last);
  const whole = kept.slice(0, at).replace(/[.,]/g, '');
  const fraction = kept.slice(at + 1);
  const thousands =
    separators.length > 1
      ? separators.every((separator) => separator === last)
      : fraction.length === 3 && decimals < 3;
  return thousands ? whole + fraction : whole + last + fraction;
}

/** How a template shows a number Field. */
export interface NumberFormat {
  /**
   * The text the template shows for `value`. It never rounds: digits beyond
   * the Field's decimals stay, so the page shows what breaks the Limit.
   */
  format(value: number): string;
  /** The text to edit for `text` it shows: without thousands separators. */
  editable(text: string): string;
}

/**
 * How the template formats a number Field, found from one value it showed:
 * the first of a few common formats that gives `sample.text` back for
 * `sample.value`. Without a sample, or when none does, numbers show in the
 * page's locale without thousands separators.
 */
export function numberFormat(
  locale: string | undefined,
  sample: { readonly text: string; readonly value: number } | undefined,
): NumberFormat {
  const tag = knownLocale(locale);
  if (sample !== undefined) {
    const decimal = separator(tag, 'decimal') ?? '.';
    const fraction = digitsAfter(sample.text, decimal);
    for (const grouping of [undefined, false, 'always'] as const) {
      const format = localeFormat(tag, fraction, grouping);
      if (format.format(sample.value) === sample.text) return format;
    }
    const raw = rawFormat(digitsAfter(sample.text, '.'));
    if (raw.format(sample.value) === sample.text) return raw;
  }
  return localeFormat(tag, 0, false);
}

type Grouping = Intl.NumberFormatOptions['useGrouping'];

function localeFormat(
  locale: string,
  minimumFractionDigits: number,
  useGrouping: Grouping,
): NumberFormat {
  const group = separator(locale, 'group', useGrouping);
  return {
    format: (value) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits: Math.max(
          minimumFractionDigits,
          fractionDigits(value),
        ),
        useGrouping,
      }).format(value),
    editable: (text) => (group ? text.split(group).join('') : text),
  };
}

/** Numbers as JavaScript prints them, with a fixed number of decimals. */
function rawFormat(minimumFractionDigits: number): NumberFormat {
  return {
    format: (value) =>
      value.toFixed(Math.max(minimumFractionDigits, fractionDigits(value))),
    editable: (text) => text,
  };
}

/** `locale` if `Intl` takes it, else English. */
function knownLocale(locale: string | undefined): string {
  try {
    return new Intl.NumberFormat(locale).resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

function separator(
  locale: string,
  type: 'decimal' | 'group',
  useGrouping?: Grouping,
): string | undefined {
  return new Intl.NumberFormat(locale, { useGrouping })
    .formatToParts(1234567.5)
    .find((part) => part.type === type)?.value;
}

/** How many digits follow the last `separator` in `text`. */
function digitsAfter(text: string, separator: string): number {
  const at = text.lastIndexOf(separator);
  return at === -1 ? 0 : (/^\d*/.exec(text.slice(at + 1))?.[0].length ?? 0);
}

/**
 * How many decimals the shortest form of `value` has, as its Limit counts
 * them, up to the most `Intl.NumberFormat` shows.
 */
function fractionDigits(value: number): number {
  return Math.min(decimalPlaces(value), 100);
}
