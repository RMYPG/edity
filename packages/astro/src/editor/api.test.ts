import { describe, expect, test } from 'vitest';
import { publishRequest } from './api.js';
import { Draft } from './draft.js';

describe('publishRequest', () => {
  test("sends the page and only the Draft's Changes, each with its value before (P3)", () => {
    const draft = new Draft([
      // Kept from before a newer Release: the server tells the Conflict (V2).
      { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio en casa' },
      { path: 'visit.price', before: 35, after: 40 },
      {
        path: 'services',
        before: ['Suelo pélvico', 'Punción seca'],
        after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
        // Only the Draft keeps these.
        origins: [1, 0, null],
      },
    ]);

    const request = publishRequest('home', draft.changes.value.values());

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      page: 'home',
      changes: [
        { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio en casa' },
        { path: 'visit.price', before: 35, after: 40 },
        {
          path: 'services',
          before: ['Suelo pélvico', 'Punción seca'],
          after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
        },
      ],
    });
  });

  test('sends nothing but the path and the values of each Change', () => {
    const change = { path: 'hero.cta', before: 'Reserva', after: 'Pide cita' };
    const recorded = { ...change, extra: 'not sent' };

    const request = publishRequest('home', [recorded]);

    expect(request.changes).toEqual([change]);
  });
});
