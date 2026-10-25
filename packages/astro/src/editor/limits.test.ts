import { describe, expect, test } from 'vitest';
import {
  isChanged,
  lineLimit,
  limitCounts,
  standing,
  type Count,
} from './limits.js';

const call = { kind: 'text', limits: { maxChars: 10, maxLines: 1 } } as const;
const title = {
  kind: 'text',
  limits: { maxChars: 60, maxLines: 2, maxLinesNarrow: 3 },
} as const;
const price = {
  kind: 'number',
  limits: { min: 5, max: 500, decimals: 2 },
} as const;
const count = {
  kind: 'number',
  limits: { min: 0, max: 1_000_000, decimals: 0 },
} as const;

describe('characters (L1, L4)', () => {
  test('count visible characters, so an emoji or an accented letter is one', () => {
    // NFC ñ, NFD ñ, a family, a flag, a thumb with a skin tone, a space and
    // "años": 10 in all.
    const text = '\u00f1n\u0303👨‍👩‍👧‍👦🇪🇸👍🏽 años';
    expect(text.length).toBe(27);

    expect(limitCounts(call, text)).toEqual([
      { limit: 'chars', count: 10, max: 10 },
    ]);
    expect(limitCounts(call, `${text}!`)).toEqual([
      { limit: 'chars', count: 11, max: 10 },
    ]);
  });

  test('show from 80% of the Limit on', () => {
    expect(limitCounts(call, 'Llámanos')).toEqual([
      { limit: 'chars', count: 8, max: 10 },
    ]);
    expect(limitCounts(call, 'Llámalos')).toHaveLength(1);
    expect(limitCounts(call, 'Llámame')).toEqual([]);
    expect(limitCounts(title, 'x'.repeat(48))).toHaveLength(1);
    expect(limitCounts(title, 'x'.repeat(47))).toEqual([]);
  });
});

describe('lines (L2)', () => {
  test('count only when the text takes more lines than its Limit', () => {
    const text = '\u00f1n\u0303👨‍👩‍👧‍👦🇪🇸👍🏽 años';
    expect(limitCounts(title, text, { lines: 2, narrow: false })).toEqual([]);
    expect(limitCounts(title, text, { lines: 3, narrow: false })).toEqual([
      { limit: 'lines', count: 3, max: 2 },
    ]);
    expect(limitCounts(call, 'Hola', { lines: 1, narrow: false })).toEqual([]);
  });

  test('take the narrow value on a narrow screen', () => {
    expect(limitCounts(title, 'Hola', { lines: 3, narrow: true })).toEqual([]);
    expect(limitCounts(title, 'Hola', { lines: 4, narrow: true })).toEqual([
      { limit: 'lines', count: 4, max: 3 },
    ]);
  });

  test('without a narrow value, the line Limit holds on every screen', () => {
    expect(lineLimit(call.limits, true)).toBe(1);
    expect(lineLimit({ maxChars: 10, maxLinesNarrow: 4 }, false)).toBe(
      undefined,
    );
    expect(lineLimit({ maxChars: 10 }, true)).toBe(undefined);
  });

  test('a Limit broken comes before one only near', () => {
    expect(
      limitCounts(title, 'x'.repeat(50), { lines: 3, narrow: false }),
    ).toEqual([
      { limit: 'lines', count: 3, max: 2 },
      { limit: 'chars', count: 50, max: 60 },
    ]);
  });
});

describe('numbers (L5)', () => {
  test('count when they are out of range', () => {
    expect(limitCounts(price, 500)).toEqual([]);
    expect(limitCounts(price, 5)).toEqual([]);
    expect(limitCounts(price, 500.01)).toEqual([{ limit: 'max', bound: 500 }]);
    expect(limitCounts(price, 4.99)).toEqual([{ limit: 'min', bound: 5 }]);
  });

  test('count text that is a number with too many decimals', () => {
    expect(limitCounts(price, '19,999')).toEqual([
      { limit: 'decimals', max: 2 },
    ]);
    // In Spain, thirteen thousand.
    expect(limitCounts(count, '13.000')).toEqual([
      { limit: 'decimals', max: 0 },
    ]);
    expect(limitCounts(price, '1000,555')).toEqual([
      { limit: 'max', bound: 500 },
      { limit: 'decimals', max: 2 },
    ]);
  });

  test('count a number with too many decimals, as a restored Draft may hold', () => {
    expect(limitCounts(price, 19.99)).toEqual([]);
    expect(limitCounts(price, 19.999)).toEqual([{ limit: 'decimals', max: 2 }]);
    expect(limitCounts(count, 0.5)).toEqual([{ limit: 'decimals', max: 0 }]);
  });

  test('text that is not a number breaks no Limit', () => {
    expect(limitCounts(price, '')).toEqual([]);
    expect(limitCounts(price, ',')).toEqual([]);
  });
});

describe('standing (L3, L7)', () => {
  const over: Count = { limit: 'chars', count: 11, max: 10 };
  const near: Count = { limit: 'chars', count: 9, max: 10 };

  test('a Field over a Limit is red only when the Draft changed it', () => {
    expect(standing([over], true)).toBe('over');
    expect(standing([over], false)).toBe('warning');
    expect(standing([over, near], true)).toBe('over');
  });

  test('a Field near a Limit, or within it, blocks nothing', () => {
    expect(standing([near], true)).toBe('near');
    expect(standing([near], false)).toBe('near');
    expect(standing([], true)).toBe('within');
  });

  describe('isChanged (L7)', () => {
    const content = {
      hero: { title: 'Fisioterapia', lead: 'Una hora' },
      services: ['Suelo pélvico', 'Punción seca', 'Masaje'],
      plans: [
        { name: 'Básico', features: ['Una sesión'] },
        { name: 'Completo', features: ['Cuatro', 'Plan'] },
      ],
    };

    test('a Field with a Change changed, and one without did not', () => {
      const changes = [
        { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio' },
        { path: 'services.1', before: 'Punción seca', after: 'Punción' },
      ];

      expect(isChanged('hero.title', changes, content)).toBe(true);
      expect(isChanged('services.1', changes, content)).toBe(true);
      expect(isChanged('hero.lead', changes, content)).toBe(false);
      expect(isChanged('hero.titles', changes, content)).toBe(false);
      expect(isChanged('services.0', changes, content)).toBe(false);
    });

    test('in a List whose structure changed, new and edited Items changed, and built ones that only moved did not (S7)', () => {
      const changes = [
        {
          path: 'services',
          before: content.services,
          after: ['Masaje', 'Suelo pélvico', 'Punción', 'Pilates'],
        },
        {
          path: 'plans',
          before: content.plans,
          after: [
            { name: 'Completo', features: ['Cuatro', 'Plan'] },
            { name: 'Básico', features: ['Una sesión', 'Correo'] },
          ],
        },
      ];

      expect(isChanged('services.0', changes, content)).toBe(false);
      expect(isChanged('services.1', changes, content)).toBe(false);
      expect(isChanged('services.2', changes, content)).toBe(true);
      expect(isChanged('services.3', changes, content)).toBe(true);
      expect(isChanged('plans.0.name', changes, content)).toBe(false);
      expect(isChanged('plans.0.features.1', changes, content)).toBe(false);
      // The card whose List gained an Item.
      expect(isChanged('plans.1.name', changes, content)).toBe(true);
      expect(isChanged('plans.1.features.0', changes, content)).toBe(true);
      expect(isChanged('plansx.0', changes, content)).toBe(false);
    });

    test('so does a List inside an Item, while the outer List is as built', () => {
      const changes = [
        {
          path: 'plans.1.features',
          before: content.plans[1]!.features,
          after: ['Plan', 'Cuatro', 'Seguimiento'],
        },
      ];

      expect(isChanged('plans.1.features.0', changes, content)).toBe(false);
      expect(isChanged('plans.1.features.2', changes, content)).toBe(true);
      expect(isChanged('plans.1.name', changes, content)).toBe(false);
    });
  });
});
