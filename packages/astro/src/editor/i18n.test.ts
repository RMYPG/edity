import { describe, expect, test } from 'vitest';
import { chooseLocale, messagesFor } from './i18n.js';

describe('chooseLocale (N6)', () => {
  test("follows the session's locale over the browser's", () => {
    expect(chooseLocale('en', ['es-ES', 'es'])).toBe('en');
    expect(chooseLocale('es', ['en-US'])).toBe('es');
  });

  test('reads only the language of a locale with a region, in any case', () => {
    expect(chooseLocale('es-MX', [])).toBe('es');
    expect(chooseLocale('EN-gb', [])).toBe('en');
    expect(chooseLocale('es_ES', [])).toBe('es');
  });

  test("falls back to the browser's first supported language", () => {
    expect(chooseLocale('fr', ['de-DE', 'es-ES', 'en'])).toBe('es');
    expect(chooseLocale(undefined, ['en-US', 'es'])).toBe('en');
    expect(chooseLocale('', ['es'])).toBe('es');
  });

  test('falls back to English', () => {
    expect(chooseLocale('fr', ['de-DE', 'pt'])).toBe('en');
    expect(chooseLocale(undefined, [])).toBe('en');
  });
});

describe('Limit counters (L3 to L5)', () => {
  const es = messagesFor('es');
  const en = messagesFor('en');

  test('show visible characters, and the excess once over', () => {
    expect(es.limit({ limit: 'chars', used: 20, max: 24 })).toBe('20/24');
    expect(es.limit({ limit: 'chars', used: 25, max: 24 })).toBe(
      '25/24 · sobra 1',
    );
    expect(es.limit({ limit: 'chars', used: 27, max: 24 })).toBe(
      '27/24 · sobran 3',
    );
    expect(en.limit({ limit: 'chars', used: 27, max: 24 })).toBe(
      '27/24 · 3 too many',
    );
  });

  test('show lines with their unit', () => {
    expect(es.limit({ limit: 'lines', used: 3, max: 2 })).toBe(
      '3/2 líneas · sobra 1',
    );
    expect(en.limit({ limit: 'lines', used: 5, max: 3 })).toBe(
      '5/3 lines · 2 too many',
    );
  });

  test("show a number's range and decimals, in the Editor's language", () => {
    expect(es.limit({ limit: 'max', bound: 1_000_000 })).toBe(
      'Máximo 1.000.000',
    );
    expect(en.limit({ limit: 'min', bound: 0.5 })).toBe('Minimum 0.5');
    expect(es.limit({ limit: 'decimals', max: 0 })).toBe('Sin decimales');
    expect(es.limit({ limit: 'decimals', max: 1 })).toBe('Máximo 1 decimal');
    expect(en.limit({ limit: 'decimals', max: 2 })).toBe('At most 2 decimals');
  });

  test('say when the content broke the Limit as published (L7)', () => {
    expect(es.published('3/2 líneas · sobra 1')).toBe(
      '3/2 líneas · sobra 1 · ya publicado así',
    );
    expect(en.published('3/2 lines · 1 too many')).toBe(
      '3/2 lines · 1 too many · already published',
    );
  });
});

describe('the restored Draft (P2)', () => {
  test('says how many Changes no longer apply', () => {
    expect(messagesFor('es').notApplied(1)).toBe('1 cambio ya no se aplica');
    expect(messagesFor('es').notApplied(3)).toBe('3 cambios ya no se aplican');
    expect(messagesFor('en').notApplied(1)).toBe('1 change no longer applies');
    expect(messagesFor('en').notApplied(2)).toBe('2 changes no longer apply');
  });
});
