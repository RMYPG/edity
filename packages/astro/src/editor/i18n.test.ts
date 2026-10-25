import { describe, expect, test } from 'vitest';
import { chooseLocale } from './i18n.js';

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
