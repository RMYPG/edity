// Draft validation: what a value breaks of the Field definitions it is
// checked against. It works on the plain definitions `definitionOf` returns,
// as a page's marker carries them to the Editor, and gives the verdicts the
// Field definitions' Zod schemas give, which the Site's build validates with.
import type { Definition } from './fields.js';
import { graphemeCount } from './graphemes.js';

/**
 * What every text Field holds: one line with at least one visible character.
 * Blank means `\t`, `\v`, `\f` or a space separator (Unicode Zs), and a line
 * break is `\n`, `\r`, U+2028 or U+2029. Zod emits this as the JSON Schema
 * `pattern`, which ECMA-262 (with the `u` flag) and Go's RE2 read alike, so it
 * avoids `\s` and `\u` escapes, whose meaning differs between the two.
 */
export const oneVisibleLine =
  /^[\t\v\f\p{Zs}]*[^\t\v\f\p{Zs}\n\r\p{Zl}\p{Zp}][^\n\r\p{Zl}\p{Zp}]*$/u;

/**
 * Counts the decimal places in the shortest decimal form of `value`, the one
 * JavaScript prints and JSON stores: 19.99 has 2, and 0.1 + 0.2 has 17. This
 * is what the `decimals` Limit of a number Field counts.
 */
export function decimalPlaces(value: number): number {
  const [mantissa = '', exponent = '0'] = String(value).split('e');
  const fraction = mantissa.split('.')[1] ?? '';
  return Math.max(0, fraction.length - Number(exponent));
}

/**
 * A rule of its Field definitions that a value breaks, at `path` in it: its
 * keys and Item indices, dot-separated, or `''` for the value itself.
 *
 * - `type`: not what the definition holds at all: text, a finite number, a
 *   List's Items or an object's Fields. A missing Field is `undefined`.
 * - `unknown`: a key the Field definitions do not have.
 * - `oneLine`: text with no visible character, or with a line break.
 * - `maxChars`: text with more visible characters than the Limit.
 * - `min`, `max`: a number out of its range, `bound`.
 * - `decimals`: a number with more decimal places than the Limit.
 * - `minItems`, `maxItems`: a List with fewer or more Items than its bound.
 *
 * Line Limits are never checked: only a browser can measure lines.
 */
export type Violation =
  | { readonly path: string; readonly rule: 'type' | 'unknown' | 'oneLine' }
  | {
      readonly path: string;
      readonly rule: 'maxChars' | 'decimals';
      /** What the Limit allows. */
      readonly max: number;
      /** What the value has: visible characters, or decimal places. */
      readonly count: number;
    }
  | {
      readonly path: string;
      readonly rule: 'min' | 'max' | 'minItems' | 'maxItems';
      readonly bound: number;
    };

/**
 * Every rule of `definition` that `value` breaks, in the order of the
 * definition: none when `value` is one the Field, List or object can hold.
 */
export function violations(
  definition: Definition,
  value: unknown,
): Violation[] {
  const found: Violation[] = [];
  check(definition, value, '', found);
  return found;
}

function check(
  definition: Definition,
  value: unknown,
  path: string,
  found: Violation[],
): void {
  switch (definition.kind) {
    case 'text': {
      if (typeof value !== 'string') {
        found.push({ path, rule: 'type' });
        return;
      }
      if (!oneVisibleLine.test(value)) found.push({ path, rule: 'oneLine' });
      const { maxChars } = definition.limits;
      const count = graphemeCount(value);
      if (count > maxChars) {
        found.push({ path, rule: 'maxChars', max: maxChars, count });
      }
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        found.push({ path, rule: 'type' });
        return;
      }
      const { min, max, decimals } = definition.limits;
      if (value < min) found.push({ path, rule: 'min', bound: min });
      if (value > max) found.push({ path, rule: 'max', bound: max });
      const places = decimalPlaces(value);
      if (places > decimals) {
        found.push({ path, rule: 'decimals', max: decimals, count: places });
      }
      return;
    }
    case 'list': {
      if (!Array.isArray(value)) {
        found.push({ path, rule: 'type' });
        return;
      }
      const { min, max } = definition.limits;
      if (value.length < min) {
        found.push({ path, rule: 'minItems', bound: min });
      }
      if (value.length > max) {
        found.push({ path, rule: 'maxItems', bound: max });
      }
      value.forEach((item: unknown, index) =>
        check(definition.item, item, inside(path, String(index)), found),
      );
      return;
    }
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        found.push({ path, rule: 'type' });
        return;
      }
      const fields = value as Record<string, unknown>;
      for (const [key, field] of Object.entries(definition.shape)) {
        const at = Object.hasOwn(fields, key) ? fields[key] : undefined;
        check(field, at, inside(path, key), found);
      }
      for (const key of Object.keys(fields)) {
        if (!Object.hasOwn(definition.shape, key)) {
          found.push({ path: inside(path, key), rule: 'unknown' });
        }
      }
      return;
    }
  }
}

function inside(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}
