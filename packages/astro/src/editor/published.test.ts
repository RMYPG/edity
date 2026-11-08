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

  describe('a Field published before its List moved', () => {
    const basic = { name: 'Básico', price: 45 };
    const plus = { name: 'Plus', price: 45 };
    const raised = { ...basic, price: 50 };
    const price = publish('plans.0.price', 45, 50);
    const swap = publish('plans', [raised, plus], [plus, raised]);

    test('is built with the List once the List is', () => {
      // `plans.0.price` is Plus now, and reads what the Change had before.
      expect(stillToBuild({ plans: [plus, raised] }, [price, swap])).toEqual(
        [],
      );
    });

    test('is still to build with the List while neither is', () => {
      expect(stillToBuild({ plans: [basic, plus] }, [price, swap])).toEqual([
        price,
        swap,
      ]);
    });

    test('is built before the List when the build has only it', () => {
      expect(stillToBuild({ plans: [raised, plus] }, [price, swap])).toEqual([
        swap,
      ]);
    });

    test('leaves a Change published after the List, still to build', () => {
      const next = publish('plans.0.price', 45, 60);

      expect(
        stillToBuild({ plans: [plus, raised] }, [price, swap, next]),
      ).toEqual([next]);
    });
  });

  test('keeps a Change to another Field, whatever became of the rest', () => {
    const title = publish('hero.title', 'A', 'B');
    const price = publish('visit.price', 35, 40);

    // The price was built, from an earlier Publish the server had already.
    expect(
      stillToBuild({ hero: { title: 'A' }, visit: { price: 40 } }, [
        title,
        price,
      ]),
    ).toEqual([title]);
  });

  test('leaves the content as it was', () => {
    const content = { hero: { title: 'A' } };

    stillToBuild(content, [publish('hero.title', 'A', 'B')]);

    expect(content).toEqual({ hero: { title: 'A' } });
  });
});
