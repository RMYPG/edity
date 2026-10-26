import { describe, expect, test } from 'vitest';
import { Draft, type Change } from './draft.js';
import { draftStore, keepDraft, type KeptStorage } from './draft-store.js';

const title: Change = {
  path: 'hero.title',
  before: 'Fisioterapia en casa',
  after: 'Fisioterapia a domicilio',
};
const price: Change = { path: 'visit.price', before: 35, after: 40 };
const services: Change = {
  path: 'services',
  before: ['Suelo pélvico', 'Punción seca'],
  after: ['Punción seca', 'Suelo pélvico', ''],
};
const plans: Change = {
  path: 'plans',
  before: [{ name: 'Básico', price: 19.99, features: ['Una sesión'] }],
  after: [
    { name: 'Básico', price: 19.99, features: ['Una sesión'] },
    { name: '', price: '', features: [''] },
  ],
};

/** A browser's storage for one origin, in memory. */
function memory(): KeptStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

describe('draftStore', () => {
  test('keeps the Changes of a page, in order, and gives them back after a reload (P2)', () => {
    const storage = memory();
    draftStore('fixture', 'home', () => storage).keep([
      title,
      services,
      price,
      plans,
    ]);

    // A new page load.
    const changes = draftStore('fixture', 'home', () => storage).load();

    expect(changes).toEqual([title, services, price, plans]);
  });

  test("keeps them under a key for the Site and the page, apart from other Sites' and pages'", () => {
    const storage = memory();

    draftStore('fixture', 'home', () => storage).keep([title]);

    expect([...storage.items.keys()]).toEqual(['edity:draft:v1:fixture:home']);
    expect(draftStore('fixture', 'about', () => storage).load()).toEqual([]);
    expect(draftStore('sandbox', 'home', () => storage).load()).toEqual([]);
  });

  test('forgets the Draft once it holds no Changes, as after Discard', () => {
    const storage = memory();
    const store = draftStore('fixture', 'home', () => storage);
    store.keep([title]);

    store.keep([]);

    expect(storage.items.size).toBe(0);
    expect(store.load()).toEqual([]);
  });

  test('gives back no Changes when it kept none, or what it kept cannot be read', () => {
    const storage = memory();
    const store = draftStore('fixture', 'home', () => storage);
    const key = 'edity:draft:v1:fixture:home';

    expect(store.load()).toEqual([]);
    for (const kept of [
      '{"changes":',
      'null',
      '[]',
      '{"changes":{"hero.title":"Fisioterapia"}}',
    ]) {
      storage.items.set(key, kept);
      expect(store.load()).toEqual([]);
    }
  });

  test('gives back only what can be a Change', () => {
    const storage = memory();
    storage.items.set(
      'edity:draft:v1:fixture:home',
      JSON.stringify({
        changes: [
          title,
          { path: 'hero.lead', before: 'Una hora' },
          { path: '', before: 'a', after: 'b' },
          { path: 'stats.patients', before: 12000, after: null },
          { path: 'visit.label', before: true, after: 'Primera' },
          { path: 'services', before: [], after: [{ name: ['x', 1, false] }] },
          price,
        ],
      }),
    );

    expect(draftStore('fixture', 'home', () => storage).load()).toEqual([
      title,
      price,
    ]);
  });

  test('never throws when the browser keeps nothing, or no more', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    const full: KeptStorage = {
      getItem: blocked,
      setItem: () => {
        throw new DOMException(
          'The quota has been exceeded.',
          'QuotaExceededError',
        );
      },
      removeItem: blocked,
    };

    for (const store of [
      draftStore('fixture', 'home', blocked),
      draftStore('fixture', 'home', () => full),
    ]) {
      expect(store.load()).toEqual([]);
      expect(() => store.keep([title])).not.toThrow();
      expect(() => store.keep([])).not.toThrow();
    }
  });
});

describe('keepDraft', () => {
  test('keeps the Draft as it is now, and each time it changes, until stopped', () => {
    const storage = memory();
    const store = draftStore('fixture', 'home', () => storage);
    // Restored with a Change the page no longer has, now dropped.
    store.keep([title, price]);
    const draft = new Draft([title]);

    const stop = keepDraft(draft, store);
    expect(store.load()).toEqual([title]);
    draft.record(services);
    expect(store.load()).toEqual([title, services]);
    draft.discard();
    expect(storage.items.size).toBe(0);

    stop();
    draft.record(price);
    expect(storage.items.size).toBe(0);
  });
});
