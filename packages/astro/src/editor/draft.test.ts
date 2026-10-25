import { describe, expect, test } from 'vitest';
import { Draft, type Change } from './draft.js';

const title: Change = {
  path: 'hero.title',
  before: 'Fisioterapia en casa',
  after: 'Fisioterapia a domicilio',
};
const price: Change = { path: 'visit.price', before: 35, after: 40 };

describe('Draft', () => {
  test('starts with no Changes', () => {
    const draft = new Draft();

    expect(draft.count.value).toBe(0);
    expect([...draft.changes.value.values()]).toEqual([]);
  });

  test('starts with the Changes it is given, such as a restored Draft', () => {
    const draft = new Draft([title, price]);

    expect(draft.count.value).toBe(2);
    expect(draft.changes.value.get('visit.price')).toEqual(price);
  });

  test('counts one Change per path: recording a path again replaces its Change', () => {
    const draft = new Draft();

    draft.record(title);
    draft.record(price);
    draft.record({ ...title, after: 'Fisioterapia cerca de ti' });

    expect(draft.count.value).toBe(2);
    expect([...draft.changes.value.values()]).toEqual([
      { ...title, after: 'Fisioterapia cerca de ti' },
      price,
    ]);
  });

  test('discard drops every Change and returns them', () => {
    const draft = new Draft([title, price]);

    const dropped = draft.discard();

    expect(dropped).toEqual([title, price]);
    expect(draft.count.value).toBe(0);
  });
});
