import { describe, expect, test } from 'vitest';
import type { Change } from './draft.js';
import { stillToBuild } from './published.js';

const publish = (path: string, before: unknown, after: unknown) =>
  ({ path, before, after }) as Change;

describe('stillToBuild', () => {
  test('keeps a Change the page as built does not hold yet', () => {
    const change = publish('hero.title', 'Antes', 'Después');

    expect(stillToBuild({ hero: { title: 'Antes' } }, [change])).toEqual([
      change,
    ]);
  });

  test('drops a Change once the page is built with it', () => {
    const change = publish('hero.title', 'Antes', 'Después');

    expect(stillToBuild({ hero: { title: 'Después' } }, [change])).toEqual([]);
  });

  test('drops a Change when the page was built with another value since', () => {
    const change = publish('hero.title', 'Antes', 'Después');

    expect(stillToBuild({ hero: { title: 'Otro' } }, [change])).toEqual([]);
  });

  test('drops a Change to something the page no longer has', () => {
    const change = publish('hero.title', 'Antes', 'Después');

    expect(stillToBuild({ hero: {} }, [change])).toEqual([]);
  });

  test('reads each Change over those before it, in the order published (P8)', () => {
    const first = publish('hero.title', 'A', 'B');
    const second = publish('hero.title', 'B', 'C');

    expect(stillToBuild({ hero: { title: 'A' } }, [first, second])).toEqual([
      first,
      second,
    ]);
    // Built from the first Publish: only the second is still to come.
    expect(stillToBuild({ hero: { title: 'B' } }, [first, second])).toEqual([
      second,
    ]);
    expect(stillToBuild({ hero: { title: 'C' } }, [first, second])).toEqual([]);
  });

  test('reads a Field inside a List over a List Change before it', () => {
    const list = publish('services', ['Uno'], ['Uno', 'Dos']);
    const item = publish('services.1', 'Dos', 'Tres');

    expect(stillToBuild({ services: ['Uno'] }, [list, item])).toEqual([
      list,
      item,
    ]);
  });

  test('leaves the content as it was', () => {
    const content = { hero: { title: 'A' } };

    stillToBuild(content, [publish('hero.title', 'A', 'B')]);

    expect(content).toEqual({ hero: { title: 'A' } });
  });
});
