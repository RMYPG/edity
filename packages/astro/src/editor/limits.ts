// A Field's value against its Limits (L1 to L5, L7), apart from the DOM:
// what its counter shows, and whether it blocks Publish.
import {
  graphemeCount,
  violations,
  type NumberDefinition,
  type TextLimits,
} from '@edity/core';
import { valueAt } from './content.js';
import type { Change, ContentValue } from './draft.js';
import { originsOf } from './list-changes.js';
import { numberValue, type FieldDefinition } from './values.js';

/**
 * One Limit a Field's value is near or over, as its counter shows it.
 *
 * - `chars`: visible characters, which are grapheme clusters, so an emoji or
 *   an accented letter counts as one (L1).
 * - `lines`: lines of text as the page renders it (L2).
 * - `min`, `max`: a number below or above its range, `bound` (L5).
 * - `decimals`: a number with more decimals than the Field's `max` (L5).
 */
export type Count =
  | {
      readonly limit: 'chars' | 'lines';
      readonly count: number;
      readonly max: number;
    }
  | { readonly limit: 'min' | 'max'; readonly bound: number }
  | { readonly limit: 'decimals'; readonly max: number };

/** Whether `count` is over its Limit, rather than near it. */
export function isOver(count: Count): boolean {
  return count.limit === 'chars' || count.limit === 'lines'
    ? count.count > count.max
    : true;
}

/** What a Field's text looks like on one element of the page. */
export interface Rendered {
  /** The lines its text takes there. */
  readonly lines: number;
  /** Whether that element's window is a narrow screen (L2). */
  readonly narrow: boolean;
}

/**
 * The Limits a Field's `value` is near or over, those it is over first: what
 * its counter shows (L3, L4). Empty when the counter does not show.
 *
 * - Characters count from 80% of the Limit on.
 * - Lines count only when there are too many: a one-line Field always has
 *   all of its lines.
 * - A number counts when it is out of range, or when the Field holds text
 *   that is a number with too many decimals. Other text, such as nothing,
 *   breaks no Limit: it is not a number at all.
 */
export function limitCounts(
  definition: FieldDefinition,
  value: ContentValue,
  rendered?: Rendered,
): Count[] {
  const counts: Count[] =
    definition.kind === 'text'
      ? textCounts(definition.limits, String(value), rendered)
      : numberCounts(definition, value);
  return [...counts.filter(isOver), ...counts.filter((each) => !isOver(each))];
}

function textCounts(
  limits: TextLimits,
  value: string,
  rendered: Rendered | undefined,
): Count[] {
  const counts: Count[] = [];
  const chars = graphemeCount(value);
  if (chars * 5 >= limits.maxChars * 4) {
    counts.push({ limit: 'chars', count: chars, max: limits.maxChars });
  }
  if (rendered !== undefined) {
    const max = lineLimit(limits, rendered.narrow);
    if (max !== undefined && rendered.lines > max) {
      counts.push({ limit: 'lines', count: rendered.lines, max });
    }
  }
  return counts;
}

function numberCounts(
  definition: NumberDefinition,
  value: ContentValue,
): Count[] {
  // The Draft holds text when the Client typed no number with at most the
  // Field's decimals (E5): one with more, which breaks that Limit whatever
  // the digits are, or none at all, which breaks none.
  const typed = typeof value === 'string';
  const number = typed ? numberValue(value, Infinity) : value;
  if (typeof number !== 'number') return [];
  const counts = violations(definition, number).flatMap(
    (violation): Count[] => {
      switch (violation.rule) {
        case 'min':
        case 'max':
          return [{ limit: violation.rule, bound: violation.bound }];
        case 'decimals':
          return [{ limit: 'decimals', max: violation.max }];
        default:
          return [];
      }
    },
  );
  if (typed && !counts.some((count) => count.limit === 'decimals')) {
    counts.push({ limit: 'decimals', max: definition.limits.decimals });
  }
  return counts;
}

/**
 * The most lines a text Field may take on a screen: its narrow value on a
 * narrow one, if it has one (L2). `undefined` when it has no line Limit there.
 */
export function lineLimit(
  limits: TextLimits,
  narrow: boolean,
): number | undefined {
  return narrow ? (limits.maxLinesNarrow ?? limits.maxLines) : limits.maxLines;
}

/**
 * How a Field stands against its Limits on one element of the page.
 *
 * - `over`: it breaks a Limit and the Draft changed it, so it turns red and
 *   Publish is disabled (L3).
 * - `warning`: it breaks a Limit as published. Only Fields changed in the
 *   Draft block Publish, so it only shows a warning (L7).
 * - `near`: it is at 80% of a Limit, so its counter shows while it is being
 *   edited (L4).
 * - `within`: nothing to show.
 */
export type Standing = 'within' | 'near' | 'warning' | 'over';

/** How a Field whose counter shows `counts` stands, given whether it changed. */
export function standing(counts: readonly Count[], changed: boolean): Standing {
  if (counts.some(isOver)) return changed ? 'over' : 'warning';
  return counts.length > 0 ? 'near' : 'within';
}

/**
 * Whether the Field at `path` changed in a Draft holding `changes`, on a page
 * built from `content`: it has a Change, or it is in a List whose structure
 * changed (S7), in an Item that is not one of the List's built Items. A
 * built Item that only moved shows what was published.
 *
 * Items are matched by value, as a List shown from a Draft gets its Items
 * back (`originsOf`), so the phone preview tells the same as the page.
 */
export function isChanged(
  path: string,
  changes: Iterable<Change>,
  content: unknown,
): boolean {
  for (const change of changes) {
    if (path === change.path) return true;
    if (!path.startsWith(`${change.path}.`)) continue;
    const built = valueAt(content, change.path);
    if (!Array.isArray(change.after) || !Array.isArray(built)) return true;
    const [index = ''] = path.slice(change.path.length + 1).split('.');
    return originsOf(built, change.after)[Number(index)] === undefined;
  }
  return false;
}
