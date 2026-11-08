// P3 to P5, P8 and A3: Publish sends the Draft, and the Client follows the
// Release it becomes. edity-server is mocked with page.route().
import type { Locator, Page } from '@playwright/test';
import {
  ana,
  caretAtEnd,
  editAll,
  expect,
  field,
  focusField,
  keptDraft,
  mockPublishApi,
  test,
  texts,
} from './editor.js';

/** A Publish's commit. */
const sha = 'a'.repeat(40);

/** The fixture page's title and lead as built. */
const title = 'Fisioterapia que te devuelve el movimiento';

/** How long a poll can take to come: the Editor asks every 5 seconds. */
const nextPoll = { timeout: 12_000 };

/** Types `text` over the Field at `path`, and leaves the Field. */
async function type(page: Page, path: string, text: string): Promise<void> {
  await editAll(page, path);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

function publishButton(bar: Locator, name = 'Publicar'): Locator {
  return bar.getByRole('button', { name });
}

/** The Publish's progress, above the bar. */
function progress(editor: Locator): Locator {
  return editor.locator('.progress');
}

/** A Publish's second commit. */
const newer = 'b'.repeat(40);

/** An answer that a Publish was taken, and is at the `stage` asked next. */
function stageOf(stage: string, version = '1.4.3') {
  return { status: 200, json: { stage, version } };
}

test('Publish sends the Draft, and the bar follows it through each stage (P3, P4)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = {
    status: 200,
    json: { stage: 'validating', version: '1.4.3' },
  };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');

  await publishButton(bar).click();

  // Validating as soon as the server took it.
  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Validando');
  expect(api.published).toEqual([
    {
      page: 'home',
      changes: [{ path: 'hero.title', before: title, after: 'Otro título' }],
    },
  ]);
  // The Change left the Draft, and its value stays on the page.
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  expect(await keptDraft(page)).toBeUndefined();
  await expect(field(page, 'hero.title')).toHaveText('Otro título');
  await expect(publishButton(bar)).toBeDisabled();

  api.status[sha] = {
    status: 200,
    json: { stage: 'releasing', version: '1.4.3' },
  };
  await expect(current).toHaveText('Creando la versión', nextPoll);

  api.status[sha] = {
    status: 200,
    json: { stage: 'released', version: '1.4.3' },
  };
  await expect(current).toHaveText('Versión creada', nextPoll);
  // The end: nothing more to ask.
  const asked = api.asked.get(sha);
  await page.waitForTimeout(6_000);
  expect(api.asked.get(sha)).toBe(asked);
});

test('progress survives a reload, and the page keeps showing the new values (P4)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = {
    status: 200,
    json: { stage: 'releasing', version: '1.4.3' },
  };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await type(page, 'visit.price', '40,5');
  await publishButton(bar).click();
  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Validando');

  await page.reload();
  await expect(bar).toBeVisible();

  // Asked at once: the page as built is still the old one.
  await expect(current).toHaveText('Creando la versión');
  await expect(field(page, 'hero.title')).toHaveText('Otro título');
  await expect(field(page, 'visit.price')).toHaveText('40,50');
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');

  api.status[sha] = {
    status: 200,
    json: { stage: 'released', version: '1.4.3' },
  };
  await expect(current).toHaveText('Versión creada', nextPoll);
});

test('Publishing again during a Publish sends what the first one published as the value before (P8)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await publishButton(bar).click();
  await expect(progress(editor)).toHaveAccessibleName(
    'Publicación de la versión 1.4.3',
  );

  // Publish is open again, with the first still in progress.
  await type(page, 'hero.title', 'Tercer título');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  api.publish = { status: 202, json: { sha: newer, version: '1.4.4' } };
  api.status[newer] = stageOf('validating', '1.4.4');
  await publishButton(bar).click();

  await expect
    .poll(() => api.published)
    .toContainEqual({
      page: 'home',
      changes: [
        { path: 'hero.title', before: 'Otro título', after: 'Tercer título' },
      ],
    });
  await expect(progress(editor)).toHaveAccessibleName(
    'Publicación de la versión 1.4.4',
  );
  await expect(field(page, 'hero.title')).toHaveText('Tercer título');
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');

  // The older one is no longer followed: the newer Release contains it.
  await expect.poll(() => api.asked.get(newer), nextPoll).toBeGreaterThan(0);
  const asked = api.asked.get(sha);
  await page.waitForTimeout(6_000);
  expect(api.asked.get(sha) ?? 0).toBe(asked ?? 0);
  await expect(progress(editor)).toHaveAccessibleName(
    'Publicación de la versión 1.4.4',
  );

  await page.reload();
  await expect(bar).toBeVisible();

  // Each Publish is applied over the last, on the page as built.
  await expect(field(page, 'hero.title')).toHaveText('Tercer título');
  await type(page, 'hero.title', 'Cuarto título');
  await publishButton(bar).click();
  await expect
    .poll(() => api.published.at(-1))
    .toEqual({
      page: 'home',
      changes: [
        {
          path: 'hero.title',
          before: 'Tercer título',
          after: 'Cuarto título',
        },
      ],
    });
});

test('after a Publish, Discard goes back to what was published, not to the page as built', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();

  await type(page, 'hero.title', 'Tercer título');
  await bar.getByRole('button', { name: 'Descartar' }).click();

  await expect(field(page, 'hero.title')).toHaveText('Otro título');
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  expect(await keptDraft(page)).toBeUndefined();

  // Typing the value the page was built with is a Change now.
  await type(page, 'hero.title', title);
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  expect(await keptDraft(page)).toEqual([
    { path: 'hero.title', before: 'Otro título', after: title },
  ]);
});

test('a List published is the List as built for the next Change, also after a reload (S7, P8)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  await caretAtEnd(await focusField(page, 'services.3'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('Masaje');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');

  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  const services = [
    'Fisioterapia deportiva',
    'Suelo pélvico',
    'Punción seca',
    'Rehabilitación tras cirugía 🦴',
    'Masaje',
  ];
  await expect.poll(() => texts(page, 'services')).toEqual(services);

  // An edit to a Field of the published List is its own Change, as in any
  // List whose structure is as built.
  await caretAtEnd(await focusField(page, 'services.4'));
  await page.keyboard.type(' deportivo');
  await page.keyboard.press('Tab');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  expect(await keptDraft(page)).toEqual([
    {
      path: 'services.4',
      before: 'Masaje',
      after: 'Masaje deportivo',
    },
  ]);

  await page.reload();
  await expect(bar).toBeVisible();

  await expect
    .poll(() => texts(page, 'services'))
    .toEqual([...services.slice(0, 4), 'Masaje deportivo']);
  expect(await keptDraft(page)).toEqual([
    {
      path: 'services.4',
      before: 'Masaje',
      after: 'Masaje deportivo',
    },
  ]);
});

test('the phone preview shows what was published, as the page does (P6)', async ({
  page,
  openEditor,
  bar,
  editor,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone has no phone preview.');
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await caretAtEnd(await focusField(page, 'services.3'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('Masaje');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();

  await bar.getByRole('button', { name: 'Vista de móvil' }).click();
  const frame = page.frameLocator('edity-root iframe');

  await expect(field(frame, 'hero.title')).toHaveText('Otro título');
  await expect
    .poll(() => texts(frame, 'services'))
    .toEqual([
      'Fisioterapia deportiva',
      'Suelo pélvico',
      'Punción seca',
      'Rehabilitación tras cirugía 🦴',
      'Masaje',
    ]);

  // A new Change goes on top of it, and Discard comes back to it.
  await type(page, 'hero.title', 'Tercer título');
  await expect(field(frame, 'hero.title')).toHaveText('Tercer título');
  await bar.getByRole('button', { name: 'Descartar' }).click();
  await expect(field(frame, 'hero.title')).toHaveText('Otro título');
});

test('a Publish with Conflicts keeps those Changes in the Draft, marked, and publishes the rest (V2)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = {
    status: 202,
    json: { sha, version: '1.4.3', conflicts: [{ path: 'hero.title' }] },
  };
  api.status[sha] = stageOf('validating');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await type(page, 'visit.price', '40');

  await publishButton(bar).click();

  await expect(editor.getByRole('alert')).toHaveText(
    'Se ha publicado el resto. 1 cambio no se ha publicado porque ese contenido cambió en la web mientras lo editabas. Sigue en tu borrador, marcado en la página; descártalo si prefieres la versión de la web.Entendido',
  );
  await expect(progress(editor)).toBeVisible();
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  expect(await keptDraft(page)).toEqual([
    { path: 'hero.title', before: title, after: 'Otro título' },
  ]);
  // Both still show what the Client wrote.
  await expect(field(page, 'hero.title')).toHaveText('Otro título');
  await expect(field(page, 'visit.price')).toHaveText('40,00');
  await expect(field(page, 'hero.title')).toHaveAttribute(
    'data-edity-rejected',
    '',
  );
  await expect(field(page, 'hero.title')).toHaveCSS(
    'outline-color',
    'rgb(220, 38, 38)',
  );
  await expect(field(page, 'visit.price')).not.toHaveAttribute(
    'data-edity-rejected',
  );

  // The mark and the notice go once the Client changes it.
  await type(page, 'hero.title', 'Título corregido');
  await expect(field(page, 'hero.title')).not.toHaveAttribute(
    'data-edity-rejected',
  );
  await expect(editor.getByRole('alert')).toHaveCount(0);
});

test('a Publish that is all Conflicts leaves the Draft as it was (V2)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = {
    status: 409,
    json: { conflicts: [{ path: 'hero.title' }, { path: 'visit.price' }] },
  };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await type(page, 'visit.price', '40');

  await publishButton(bar).click();

  await expect(editor.getByRole('alert')).toHaveText(
    /^2 cambios no se han publicado porque ese contenido cambió en la web mientras los editabas\./,
  );
  await expect(bar.getByRole('status')).toHaveText('2 cambios');
  await expect(progress(editor)).toHaveCount(0);
  expect((await keptDraft(page))?.map(({ path }) => path)).toEqual([
    'hero.title',
    'visit.price',
  ]);
  await expect(field(page, 'hero.title')).toHaveAttribute(
    'data-edity-rejected',
    '',
  );
  await expect(field(page, 'visit.price')).toHaveAttribute(
    'data-edity-rejected',
    '',
  );
  await expect(publishButton(bar)).toBeEnabled();
});

test('in a 409, a Change the server already has leaves the Draft', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 409, json: { conflicts: [{ path: 'hero.title' }] } };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await type(page, 'visit.price', '40');

  await publishButton(bar).click();

  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  expect((await keptDraft(page))?.map(({ path }) => path)).toEqual([
    'hero.title',
  ]);
  await expect(field(page, 'visit.price')).toHaveText('40,00');
});

test('a 422 marks the Fields and Lists the server refused, and keeps the Draft (V1)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = {
    status: 422,
    json: {
      violations: [
        { path: 'hero.title', limit: 'maxChars' },
        { path: 'services', limit: 'maxItems' },
      ],
    },
  };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(editor.getByRole('alert')).toHaveText(
    'No se ha publicado: 2 valores no cumplen los límites de la web. Están marcados en rojo: corrígelos y vuelve a publicar. Tu borrador está a salvo.Entendido',
  );
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(field(page, 'hero.title')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(field(page, 'hero.title')).toHaveCSS(
    'outline-color',
    'rgb(220, 38, 38)',
  );
  await expect(page.locator('[data-edity-list="services"]')).toHaveAttribute(
    'data-edity-rejected',
    '',
  );

  await type(page, 'hero.title', 'Corto');

  await expect(field(page, 'hero.title')).not.toHaveAttribute('aria-invalid');
  await expect(field(page, 'hero.title')).not.toHaveAttribute(
    'data-edity-rejected',
  );
  // The Client did not touch the List.
  await expect(page.locator('[data-edity-list="services"]')).toHaveAttribute(
    'data-edity-rejected',
    '',
  );
});

test('a 422 about content the page does not show tells the Client to ask the Developer', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = {
    status: 422,
    json: { violations: [{ path: 'seo.description', limit: 'unknown' }] },
  };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(editor.getByRole('alert')).toContainText(
    'Avisa a quien mantiene tu web',
  );
  await expect(page.locator('[data-edity-rejected]')).toHaveCount(0);
});

test('an expired session sends the Client to log in, and the Draft is there on return (A3)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 401 };
  await page.route('**/_edity/login**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Zitadel</title>',
    }),
  );
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(page).toHaveURL(/\/_edity\/login\?return=%2F$/);
  expect(await keptDraft(page)).toEqual([
    { path: 'hero.title', before: title, after: 'Otro título' },
  ]);

  // Back from logging in, as the server's callback redirects.
  await page.goto('/');
  await expect(bar).toBeVisible();

  await expect(field(page, 'hero.title')).toHaveText('Otro título');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(editor.getByRole('alert')).toHaveText(
    'Tu sesión había caducado y has vuelto a entrar. Tu borrador está a salvo: pulsa Publicar para enviarlo.Entendido',
  );
  await expect(publishButton(bar)).toBeEnabled();

  // Told once: a later page load has nothing to say.
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(editor.getByRole('alert')).toHaveCount(0);
});

const failures = [
  {
    name: '409',
    answer: { status: 409, json: { conflicts: [{ path: 'hero.title' }] } },
    es: '1 cambio no se ha publicado porque ese contenido cambió en la web mientras lo editabas. Sigue en tu borrador, marcado en la página; descártalo si prefieres la versión de la web.',
    en: "1 change was not published because that content changed on the site while you were editing it. It stays in your draft, marked on the page; discard it to keep the site's version.",
  },
  {
    name: '422',
    answer: {
      status: 422,
      json: { violations: [{ path: 'hero.title', limit: 'maxChars' }] },
    },
    es: 'No se ha publicado: 1 valor no cumple los límites de la web. Está marcado en rojo: corrígelo y vuelve a publicar. Tu borrador está a salvo.',
    en: "Nothing was published: 1 value breaks the site's limits. It is marked in red: fix it and publish again. Your draft is safe.",
  },
  {
    name: '429',
    answer: { status: 429, headers: { 'Retry-After': '120' } },
    es: 'Se ha publicado demasiadas veces seguidas. Vuelve a intentarlo dentro de 2 minutos. Tu borrador está a salvo.',
    en: 'This site has been published too often lately. Try again in 2 minutes. Your draft is safe.',
  },
  {
    name: '413',
    answer: { status: 413 },
    es: 'Tu borrador es demasiado grande para publicarlo de una vez. Sigue a salvo en este navegador: avisa a quien mantiene tu web.',
    en: 'Your draft is too big to publish in one go. It is safe in this browser: tell your developer.',
  },
  {
    name: '500',
    answer: { status: 500 },
    es: 'No se ha podido publicar por un problema en la configuración de tu web, que tiene que arreglar quien la mantiene. Tu borrador está a salvo.',
    en: "Nothing was published because of a problem with your site's setup, which your developer has to fix. Your draft is safe.",
  },
  {
    name: '503',
    answer: { status: 503, headers: { 'Retry-After': '30' } },
    es: 'No se ha podido publicar en este momento. Vuelve a intentarlo dentro de un rato. Tu borrador está a salvo.',
    en: "Publishing isn't possible right now. Try again in a while. Your draft is safe.",
  },
  {
    name: '400',
    answer: { status: 400 },
    es: 'El servidor no ha aceptado esta publicación. Recarga la página y vuelve a intentarlo; si sigue igual, avisa a quien mantiene tu web. Tu borrador está a salvo.',
    en: 'The server did not accept this Publish. Reload the page and try again; if it keeps happening, tell your developer. Your draft is safe.',
  },
  {
    name: '403',
    answer: { status: 403 },
    es: 'El servidor no ha aceptado esta publicación. Recarga la página y vuelve a intentarlo; si sigue igual, avisa a quien mantiene tu web. Tu borrador está a salvo.',
    en: 'The server did not accept this Publish. Reload the page and try again; if it keeps happening, tell your developer. Your draft is safe.',
  },
  {
    name: '404',
    answer: { status: 404 },
    es: 'El servidor no ha aceptado esta publicación. Recarga la página y vuelve a intentarlo; si sigue igual, avisa a quien mantiene tu web. Tu borrador está a salvo.',
    en: 'The server did not accept this Publish. Reload the page and try again; if it keeps happening, tell your developer. Your draft is safe.',
  },
  {
    name: 'a 202 that names no commit',
    answer: { status: 202, json: {} },
    es: 'No se ha podido conectar con el servidor. Comprueba tu conexión y vuelve a publicar. Tu borrador está a salvo.',
    en: 'The server could not be reached. Check your connection and publish again. Your draft is safe.',
  },
  {
    name: 'a dropped connection',
    answer: 'abort',
    es: 'No se ha podido conectar con el servidor. Comprueba tu conexión y vuelve a publicar. Tu borrador está a salvo.',
    en: 'The server could not be reached. Check your connection and publish again. Your draft is safe.',
  },
] as const;

for (const { name, answer, es, en } of failures) {
  for (const [locale, message, button] of [
    ['es', es, 'Publicar'],
    ['en', en, 'Publish'],
  ] as const) {
    test(`${name} says what happened in ${locale} and keeps the Draft (P5)`, async ({
      page,
      openEditor,
      bar,
      editor,
    }) => {
      const api = await mockPublishApi(page);
      api.publish = answer;
      await openEditor({ session: { ...ana, locale } });
      await type(page, 'hero.title', 'Otro título');

      await publishButton(bar, button).click();

      await expect(editor.getByRole('alert').locator('span')).toHaveText(
        message,
      );
      await expect(publishButton(bar, button)).toBeEnabled();
      await expect(field(page, 'hero.title')).toHaveText('Otro título');
      expect(await keptDraft(page)).toEqual([
        { path: 'hero.title', before: title, after: 'Otro título' },
      ]);
      await expect(progress(editor)).toHaveCount(0);
      // Still editable.
      await expect(field(page, 'hero.title')).toHaveAttribute(
        'contenteditable',
        'plaintext-only',
      );

      await editor
        .getByRole('alert')
        .getByRole('button', { name: locale === 'es' ? 'Entendido' : 'OK' })
        .click();
      await expect(editor.getByRole('alert')).toHaveCount(0);
    });
  }
}

test('while the Draft is on its way, nothing on the page can change and Publish cannot be pressed twice', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await page.unroute('**/_edity/api/publish');
  await page.route('**/_edity/api/publish', async (route) => {
    api.published.push(route.request().postDataJSON());
    await answered;
    await route.fulfill({ status: 202, json: { sha, version: '1.4.3' } });
  });
  api.status[sha] = stageOf('validating');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(publishButton(bar, 'Publicando…')).toBeDisabled();
  await expect(bar.getByRole('button', { name: 'Descartar' })).toBeDisabled();
  await expect(field(page, 'hero.title')).not.toHaveAttribute(
    'contenteditable',
  );

  answer();

  await expect(progress(editor)).toBeVisible();
  await expect(field(page, 'hero.title')).toHaveAttribute(
    'contenteditable',
    'plaintext-only',
  );
  expect(api.published).toHaveLength(1);
});

test('a failed Release says the changes are saved and the Developer told, also after a reload (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('failed');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Ha fallado', nextPoll);
  const failure =
    'Tus cambios están guardados, pero aún no se ven en la web: algo ha fallado por el camino. Ya se ha avisado a quien mantiene tu web.';
  await expect(editor.getByRole('alert').locator('span')).toHaveText(failure);
  // The Publish reached the server, so it is not in the Draft.
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');

  await page.reload();
  await expect(bar).toBeVisible();

  await expect(current).toHaveText('Ha fallado');
  await expect(editor.getByRole('alert').locator('span')).toHaveText(failure);
  await expect(field(page, 'hero.title')).toHaveText('Otro título');

  // Closing it forgets it: nothing comes back on the next page load.
  await progress(editor).getByRole('button', { name: 'Entendido' }).click();
  await expect(progress(editor)).toHaveCount(0);
  await expect(editor.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(progress(editor)).toHaveCount(0);
});

test('a Publish that fails and is then covered by a newer Release shows it after a reload (P8)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('failed');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await publishButton(bar).click();
  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Ha fallado', nextPoll);

  api.status[sha] = stageOf('released');
  await page.reload();
  await expect(bar).toBeVisible();

  await expect(current).toHaveText('Versión creada');
  await expect(editor.getByRole('alert')).toHaveCount(0);
});

for (const stage of ['deploying', 'live']) {
  test(`the server's ${stage}, which comes with ticket 33, shows as Released`, async ({
    page,
    openEditor,
    bar,
    editor,
  }) => {
    const api = await mockPublishApi(page);
    api.publish = { status: 202, json: { sha, version: '1.4.3' } };
    api.status[sha] = stageOf(stage);
    await openEditor();
    await type(page, 'hero.title', 'Otro título');

    await publishButton(bar).click();

    await expect(progress(editor).locator('[aria-current="step"]')).toHaveText(
      'Versión creada',
      nextPoll,
    );
  });
}

test('when the progress cannot be read, the bar keeps its stage and says so, and asks again (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  test.setTimeout(60_000);
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = { status: 503, headers: { 'Retry-After': '1' } };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Validando');
  const unknown = progress(editor).getByText(
    'No se puede comprobar ahora cómo va la publicación. Tus cambios están guardados.',
  );
  // Only once it has failed twice: a moment's 503 is not worth a word.
  await expect(unknown).toBeVisible({ timeout: 20_000 });

  api.status[sha] = stageOf('releasing');

  await expect(current).toHaveText('Creando la versión', nextPoll);
  await expect(unknown).toHaveCount(0);
});

test('a session that ends while the progress is followed says so, and stops asking (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = { status: 401 };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(
    progress(editor).getByText(
      'No se puede comprobar ahora cómo va la publicación. Tus cambios están guardados.',
    ),
  ).toBeVisible(nextPoll);
  const asked = api.asked.get(sha);
  await page.waitForTimeout(6_000);
  expect(api.asked.get(sha)).toBe(asked);
});

test('a commit the server does not know as a Publish stops being followed', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = { status: 404 };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();

  await expect(progress(editor)).toHaveCount(0, nextPoll);
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(progress(editor)).toHaveCount(0);
});

test('an Item whose removal is published can no longer be put back (S6)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  const services = await texts(page, 'services');
  await focusField(page, 'services.3');
  await editor.getByRole('button', { name: `Quitar «${services[3]}»` }).click();
  const undo = editor.getByRole('button', { name: 'Deshacer' });
  await expect(undo).toBeVisible();

  await publishButton(bar).click();

  await expect(progress(editor)).toBeVisible();
  await expect(undo).toHaveCount(0);
  await expect
    .poll(() => texts(page, 'services'))
    .toEqual(services.slice(0, 3));
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
});
