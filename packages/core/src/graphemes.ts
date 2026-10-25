let segmenter: Intl.Segmenter | undefined;

/**
 * Counts the visible characters in `value`: its extended grapheme clusters
 * (Unicode UAX #29), so an emoji, a flag or a letter with a combining accent
 * counts as one. This is what the `maxChars` Limit of a text Field counts.
 */
export function graphemeCount(value: string): number {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return [...segmenter.segment(value)].length;
}
