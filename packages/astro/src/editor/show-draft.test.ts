import { describe, expect, test } from 'vitest';
import type { Change } from './draft.js';
import { draftDelta } from './show-draft.js';

const title: Change = {
  path: 'hero.title',
  before: 'Fisioterapia en casa',
  after: 'Fisioterapia a domicilio',
};
const price: Change = { path: 'visit.price', before: 35, after: 40 };
const services: Change = {
  path: 'services',
  before: ['Suelo pélvico', 'Punción seca'],
  after: ['Punción seca', 'Suelo pélvico'],
};

const draft = (...changes: Change[]) =>
  new Map(changes.map((change) => [change.path, change]));

describe('draftDelta', () => {
  test('a document showing no Draft shows every Change', () => {
    expect(draftDelta(draft(), draft(title, price))).toEqual([title, price]);
  });

  test('shows a Change whose value changed, and none that did not', () => {
    const typed = { ...title, after: 'Fisioterapia a domicilio ya' };

    expect(draftDelta(draft(title, price), draft(typed, price))).toEqual([
      typed,
    ]);
  });

  test('a Change recorded again with the same value shows nothing', () => {
    expect(
      draftDelta(draft(title, services), draft({ ...title }, { ...services })),
    ).toEqual([]);
  });

  test('puts back a dropped Change as built, before showing the rest', () => {
    // A structural Change to a List replaces the Changes to its Fields (S7).
    const name: Change = { path: 'services.0', before: 'Suelo', after: 'Sue' };

    expect(draftDelta(draft(name, price), draft(price, services))).toEqual([
      { path: 'services.0', before: 'Suelo', after: 'Suelo' },
      services,
    ]);
  });

  test('a discarded Draft puts every Change back as built', () => {
    expect(draftDelta(draft(title, price), draft())).toEqual([
      { ...title, after: title.before },
      { ...price, after: price.before },
    ]);
  });
});
