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

describe('a Release that failed after the commit (P5)', () => {
  test('says the changes are saved, not live yet, and the Developer has been notified', () => {
    expect(messagesFor('es').releaseFailed).toBe(
      'Tus cambios están guardados, pero aún no se ven en la web: algo ha fallado por el camino. Ya se ha avisado a quien mantiene tu web.',
    );
    expect(messagesFor('en').releaseFailed).toBe(
      'Your changes are saved, but they are not live yet: something went wrong on the way. Your developer has been notified.',
    );
  });
});

describe('what a Publish came to (P5)', () => {
  const es = messagesFor('es').publishing;
  const en = messagesFor('en').publishing;

  test('names each stage a Publish goes through (P4)', () => {
    expect(es.stages).toEqual({
      validating: 'Validando',
      releasing: 'Creando la versión',
      released: 'Versión creada',
      failed: 'Ha fallado',
    });
    expect(en.stages).toEqual({
      validating: 'Validating',
      releasing: 'Releasing',
      released: 'Released',
      failed: 'Failed',
    });
  });

  test('says which Changes conflicted, that they stay in the Draft and how to let them go (V2)', () => {
    expect(es.notice({ kind: 'conflicts', count: 1, published: false })).toBe(
      '1 cambio no se ha publicado porque ese contenido cambió en la web mientras lo editabas. Sigue en tu borrador, marcado en la página; descártalo si prefieres la versión de la web.',
    );
    expect(es.notice({ kind: 'conflicts', count: 2, published: true })).toBe(
      'Se ha publicado el resto. 2 cambios no se han publicado porque ese contenido cambió en la web mientras los editabas. Siguen en tu borrador, marcados en la página; descártalos si prefieres la versión de la web.',
    );
    expect(en.notice({ kind: 'conflicts', count: 1, published: false })).toBe(
      "1 change was not published because that content changed on the site while you were editing it. It stays in your draft, marked on the page; discard it to keep the site's version.",
    );
    expect(en.notice({ kind: 'conflicts', count: 2, published: true })).toBe(
      "The rest was published. 2 changes were not published because that content changed on the site while you were editing them. They stay in your draft, marked on the page; discard them to keep the site's version.",
    );
  });

  test('says what the server refused, and whether the Client can fix it', () => {
    expect(es.notice({ kind: 'violations', count: 1, marked: true })).toBe(
      'No se ha publicado: 1 valor no cumple los límites de la web. Está marcado en rojo: corrígelo y vuelve a publicar. Tu borrador está a salvo.',
    );
    expect(es.notice({ kind: 'violations', count: 2, marked: true })).toBe(
      'No se ha publicado: 2 valores no cumplen los límites de la web. Están marcados en rojo: corrígelos y vuelve a publicar. Tu borrador está a salvo.',
    );
    expect(en.notice({ kind: 'violations', count: 1, marked: true })).toBe(
      "Nothing was published: 1 value breaks the site's limits. It is marked in red: fix it and publish again. Your draft is safe.",
    );
    expect(en.notice({ kind: 'violations', count: 2, marked: true })).toBe(
      "Nothing was published: 2 values break the site's limits. They are marked in red: fix them and publish again. Your draft is safe.",
    );
    expect(es.notice({ kind: 'violations', count: 1, marked: false })).toBe(
      'No se ha publicado: hay contenido que no cumple los límites de la web y no se puede corregir desde aquí. Avisa a quien mantiene tu web. Tu borrador está a salvo.',
    );
    expect(en.notice({ kind: 'violations', count: 1, marked: false })).toBe(
      "Nothing was published: some content breaks the site's limits and can't be fixed from here. Tell your developer. Your draft is safe.",
    );
  });

  test('tells a Client back from logging in to press Publish again (A3)', () => {
    expect(es.notice({ kind: 'signed-back-in' })).toBe(
      'Tu sesión había caducado y has vuelto a entrar. Tu borrador está a salvo: pulsa Publicar para enviarlo.',
    );
    expect(en.notice({ kind: 'signed-back-in' })).toBe(
      'Your session had expired and you have logged in again. Your draft is safe: press Publish to send it.',
    );
  });

  test('says how long to wait after too many Publishes (V5)', () => {
    const notice = (retryAfter: number | undefined) =>
      ({ kind: 'rate-limited', retryAfter }) as const;

    expect(es.notice(notice(45))).toBe(
      'Se ha publicado demasiadas veces seguidas. Vuelve a intentarlo dentro de 1 minuto. Tu borrador está a salvo.',
    );
    expect(es.notice(notice(121))).toBe(
      'Se ha publicado demasiadas veces seguidas. Vuelve a intentarlo dentro de 3 minutos. Tu borrador está a salvo.',
    );
    expect(es.notice(notice(undefined))).toBe(
      'Se ha publicado demasiadas veces seguidas. Vuelve a intentarlo dentro de un rato. Tu borrador está a salvo.',
    );
    expect(en.notice(notice(60))).toBe(
      'This site has been published too often lately. Try again in 1 minute. Your draft is safe.',
    );
    expect(en.notice(notice(600))).toBe(
      'This site has been published too often lately. Try again in 10 minutes. Your draft is safe.',
    );
    expect(en.notice(notice(undefined))).toBe(
      'This site has been published too often lately. Try again in a while. Your draft is safe.',
    );
  });

  test.each([
    {
      kind: 'too-large',
      es: 'Tu borrador es demasiado grande para publicarlo de una vez. Sigue a salvo en este navegador: avisa a quien mantiene tu web.',
      en: 'Your draft is too big to publish in one go. It is safe in this browser: tell your developer.',
    },
    {
      kind: 'site-broken',
      es: 'No se ha podido publicar por un problema en la configuración de tu web, que tiene que arreglar quien la mantiene. Tu borrador está a salvo.',
      en: "Nothing was published because of a problem with your site's setup, which your developer has to fix. Your draft is safe.",
    },
    {
      kind: 'unavailable',
      es: 'No se ha podido publicar en este momento. Vuelve a intentarlo dentro de un rato. Tu borrador está a salvo.',
      en: "Publishing isn't possible right now. Try again in a while. Your draft is safe.",
    },
    {
      kind: 'refused',
      es: 'El servidor no ha aceptado esta publicación. Recarga la página y vuelve a intentarlo; si sigue igual, avisa a quien mantiene tu web. Tu borrador está a salvo.',
      en: 'The server did not accept this Publish. Reload the page and try again; if it keeps happening, tell your developer. Your draft is safe.',
    },
    {
      kind: 'offline',
      es: 'No se ha podido conectar con el servidor. Comprueba tu conexión y vuelve a publicar. Tu borrador está a salvo.',
      en: 'The server could not be reached. Check your connection and publish again. Your draft is safe.',
    },
  ] as const)('says what happened when a Publish fails: $kind', (message) => {
    expect(es.notice({ kind: message.kind })).toBe(message.es);
    expect(en.notice({ kind: message.kind })).toBe(message.en);
  });

  test('says when the server no longer knows the Publish it followed', () => {
    expect(es.notice({ kind: 'lost' })).toBe(
      'No se puede seguir esta publicación porque la web ya no la reconoce, así que esos cambios pueden no llegar a verse. Recarga la página para ver lo que hay publicado y avisa a quien mantiene tu web. Tu borrador está a salvo.',
    );
    expect(en.notice({ kind: 'lost' })).toBe(
      "This Publish can't be followed because the site no longer knows it, so those changes may not go live. Reload the page to see what is published, and tell your developer. Your draft is safe.",
    );
  });

  test("says when a Publish's progress can't be read", () => {
    expect(es.progressUnknown).toBe(
      'No se puede comprobar ahora cómo va la publicación. Tus cambios están guardados.',
    );
    expect(en.progressUnknown).toBe(
      "This Publish's progress can't be checked right now. Your changes are saved.",
    );
  });
});
