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
  type MockPublishApi,
} from './editor.js';

/** A Publish's commit. */
const sha = 'a'.repeat(40);

/** The fixture page's title as built. */
const title = 'Fisioterapia que te devuelve el movimiento';

/** How often the Editor asks for a Publish's progress, in ms. */
const pollEvery = 5_000;

/**
 * Moves the page's clock on to the Editor's next poll, instead of waiting 5
 * seconds for it. Install the clock before the page loads, and call this once
 * the page shows the answer that set the poll: before it, there is no poll to
 * move on to, and it comes in real time.
 */
async function nextPoll(page: Page): Promise<void> {
  await page.clock.fastForward(pollEvery);
}

/**
 * Waits a second in real time, for a request the page has sent to reach
 * page.route(): only then does `asked` show that nothing was asked.
 */
async function letRequestsArrive(page: Page): Promise<void> {
  await page.waitForTimeout(1_000);
}

/**
 * Moves the page's clock past the Editor's next poll, to check that nothing
 * more is asked.
 */
async function pastNextPoll(page: Page): Promise<void> {
  await page.clock.fastForward(pollEvery + 1_000);
  await letRequestsArrive(page);
}

/**
 * Moves the page's clock on a poll at a time until the Editor has asked for
 * `sha`'s progress `count` times, for answers the bar shows nothing of. It
 * moves the clock only while fewer have been asked, so it never sets off a
 * poll more. A move made before the last answer has set the next poll sets
 * off nothing, and the next move does.
 */
async function askedUntil(
  page: Page,
  api: MockPublishApi,
  sha: string,
  count: number,
): Promise<void> {
  await expect
    .poll(async () => {
      if ((api.asked.get(sha) ?? 0) < count) await nextPoll(page);
      return api.asked.get(sha) ?? 0;
    })
    .toBe(count);
}

/**
 * Stops the page's clock, so that it moves only when the test moves it: a
 * poll set from then on comes exactly when the Editor set it to.
 */
async function stopClock(page: Page): Promise<void> {
  // A second ahead: the page's clock goes on while its time is read.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
}

/**
 * Why a test runs in Chromium only: all it checks is how the Editor follows a
 * Publish's progress, its own logic, the same in any browser. The tests of how
 * the bar shows the progress run in every browser.
 */
const followingOnly = 'following a Publish is the same in any browser';

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

/** Holds the next Publish until the function it returns is called: a 202. */
async function holdPublish(
  page: Page,
  api: MockPublishApi,
): Promise<() => void> {
  let answer: () => void = () => {};
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await page.unroute('**/_edity/api/publish');
  await page.route('**/_edity/api/publish', async (route) => {
    api.published.push(route.request().postDataJSON());
    await answered;
    await route.fulfill({ status: 202, json: { sha, version: '1.4.3' } });
  });
  return answer;
}

/**
 * Serves the fixture page as `built` makes its HTML, from the next page load
 * on: another build of it. Returns the function that changes what it makes.
 */
async function serveBuild(
  page: Page,
  built: (html: string) => string,
): Promise<(next: (html: string) => string) => void> {
  let current = built;
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: current(await response.text()) });
    },
  );
  return (next) => (current = next);
}

/** Serves the fixture page at /otra too, as another page of the Site. */
async function serveOtherPage(page: Page): Promise<void> {
  await page.route('**/otra', async (route) => {
    const home = new URL('/', route.request().url()).href;
    const response = await route.fetch({ url: home });
    const html = await response.text();
    await route.fulfill({
      response,
      body: html.replace(
        '&quot;page&quot;:&quot;home&quot;',
        '&quot;page&quot;:&quot;otra&quot;',
      ),
    });
  });
}

/** That a Publish's progress cannot be read, as the Client is told. */
const progressUnknown =
  'No se puede comprobar ahora cómo va la publicación. Tus cambios están guardados.';

test('Publish sends the Draft, and the bar follows it through each stage (P3, P4)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
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
  await nextPoll(page);
  await expect(current).toHaveText('Creando la versión');

  api.status[sha] = {
    status: 200,
    json: { stage: 'released', version: '1.4.3' },
  };
  await nextPoll(page);
  await expect(current).toHaveText('Versión creada');
  // The end: nothing more to ask.
  const asked = api.asked.get(sha);
  await pastNextPoll(page);
  expect(api.asked.get(sha)).toBe(asked);
});

test('progress survives a reload, and the page keeps showing the new values (P4)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
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
  await nextPoll(page);
  await expect(current).toHaveText('Versión creada');
});

test('Publishing again during a Publish sends what the first one published as the value before (P8)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
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

  // The older one is no longer followed: the newer Release contains it. Once
  // the bar shows the newer one's next stage, its next poll is set.
  api.status[newer] = stageOf('releasing', '1.4.4');
  await nextPoll(page);
  await expect(progress(editor).locator('[aria-current="step"]')).toHaveText(
    'Creando la versión',
  );
  await expect.poll(() => api.asked.get(newer)).toBeGreaterThan(0);
  const asked = api.asked.get(sha);
  await pastNextPoll(page);
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
  const answer = await holdPublish(page, api);
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

test('while the Draft is on its way, an empty List offers no way to add to it (S1)', async ({
  page,
  signIn,
  bar,
  editor,
}) => {
  // The fixture's services take 1 to 8 Items: this page's take 0 to 8.
  await page.route('/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /(&quot;services&quot;:\{&quot;kind&quot;:&quot;list&quot;,&quot;limits&quot;:\{&quot;min&quot;:)1/,
      (_, start: string) => `${start}0`,
    );
    await route.fulfill({ response, body: html });
  });
  const api = await mockPublishApi(page);
  const answer = await holdPublish(page, api);
  api.status[sha] = stageOf('validating');
  await signIn();
  await page.goto('/');
  await expect(bar).toBeVisible();
  for (const service of await texts(page, 'services')) {
    await focusField(page, 'services.0');
    await editor.getByRole('button', { name: `Quitar «${service}»` }).click();
  }
  await page.getByRole('heading', { name: 'Bonos' }).click();
  const add = editor.getByRole('button', {
    name: 'Añadir elemento',
    exact: true,
  });
  await expect(add).toBeVisible();

  await publishButton(bar).click();

  await expect(publishButton(bar, 'Publicando…')).toBeDisabled();
  await expect(add).toHaveCount(0);

  answer();

  await expect(add).toBeVisible();
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
});

test('a failed Release says the changes are saved and the Developer told, also after a reload (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('failed');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(progress(editor)).toBeVisible();
  await nextPoll(page);
  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Ha fallado');
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
  browserName,
}) => {
  test.skip(browserName !== 'chromium', followingOnly);
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('failed');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();
  await nextPoll(page);
  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Ha fallado');

  api.status[sha] = stageOf('released');
  await page.reload();
  await expect(bar).toBeVisible();

  await expect(current).toHaveText('Versión creada');
  await expect(editor.getByRole('alert')).toHaveCount(0);
});

test('a failed Publish that a newer Release covers shows it without a reload (P8)', async ({
  page,
  openEditor,
  bar,
  editor,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', followingOnly);
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('failed');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await stopClock(page);
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();
  const current = progress(editor).locator('[aria-current="step"]');

  // One under way is asked 5 seconds after the server took it, not sooner.
  await page.clock.fastForward(pollEvery - 1);
  await letRequestsArrive(page);
  expect(api.asked.get(sha) ?? 0).toBe(0);
  await page.clock.fastForward(1);
  await expect(current).toHaveText('Ha fallado');
  await expect(editor.getByRole('alert')).toBeVisible();

  // Nothing comes of it soon, so it is not asked as often as one under way.
  api.status[sha] = stageOf('released');
  const asked = api.asked.get(sha);
  await page.clock.fastForward(20_000);
  await letRequestsArrive(page);
  expect(api.asked.get(sha)).toBe(asked);

  await page.clock.fastForward(10_000);

  await expect(current).toHaveText('Versión creada');
  await expect(editor.getByRole('alert')).toHaveCount(0);
});

test('the alert of a failed Release leaves the Undo of a removed Item within reach (S6)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('failed');
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();
  await nextPoll(page);
  await expect(progress(editor).locator('[aria-current="step"]')).toHaveText(
    'Ha fallado',
  );
  const services = await texts(page, 'services');

  await focusField(page, 'services.3');
  await editor.getByRole('button', { name: `Quitar «${services[3]}»` }).click();
  // A click needs the button to be what is at that point of the window.
  await editor.getByRole('button', { name: 'Deshacer' }).click();

  await expect.poll(() => texts(page, 'services')).toEqual(services);
  await expect(editor.getByRole('alert')).toBeVisible();
});

for (const stage of ['deploying', 'live']) {
  test(`the server's ${stage}, which comes with ticket 33, shows as Released`, async ({
    page,
    openEditor,
    bar,
    editor,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', followingOnly);
    await page.clock.install();
    const api = await mockPublishApi(page);
    api.publish = { status: 202, json: { sha, version: '1.4.3' } };
    api.status[sha] = stageOf(stage);
    await openEditor();
    await type(page, 'hero.title', 'Otro título');

    await publishButton(bar).click();

    await expect(progress(editor)).toBeVisible();
    await nextPoll(page);
    await expect(progress(editor).locator('[aria-current="step"]')).toHaveText(
      'Versión creada',
    );
  });
}

test('when the progress cannot be read, the bar keeps its stage and says so, and asks again (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', followingOnly);
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  const unavailable = { status: 503, headers: { 'Retry-After': '1' } };
  // The second answer waits, so the bar can be seen between the two.
  let answerSecond: () => void = () => {};
  const second = new Promise<void>((resolve) => (answerSecond = resolve));
  api.status[sha] = async () => {
    if (api.asked.get(sha) === 2) await second;
    return unavailable;
  };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  const current = progress(editor).locator('[aria-current="step"]');
  await expect(current).toHaveText('Validando');
  const unknown = editor.getByText(progressUnknown);
  // Only once it has failed twice: a moment's 503 is not worth a word. The
  // second poll comes once the first 503 is handled.
  await askedUntil(page, api, sha, 2);
  await expect(unknown).toHaveCount(0);
  answerSecond();
  await expect(unknown).toBeVisible();
  expect(api.asked.get(sha)).toBe(2);

  api.status[sha] = stageOf('releasing');

  await nextPoll(page);
  await expect(current).toHaveText('Creando la versión');
  await expect(unknown).toHaveCount(0);
});

test('a session that ends while the progress is followed says so, and stops asking (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', followingOnly);
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = { status: 401 };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');

  await publishButton(bar).click();

  await expect(progress(editor)).toBeVisible();
  await nextPoll(page);
  await expect(editor.getByText(progressUnknown)).toBeVisible();
  const asked = api.asked.get(sha);
  await pastNextPoll(page);
  expect(api.asked.get(sha)).toBe(asked);
});

test('the progress takes one line, under the notices, on any screen (P4)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = {
    status: 202,
    json: { sha, version: '1.4.3', conflicts: [{ path: 'hero.title' }] },
  };
  api.status[sha] = { status: 401 };
  await openEditor();
  await type(page, 'hero.title', 'Otro título');
  await type(page, 'visit.price', '40');

  await publishButton(bar).click();

  await expect(progress(editor)).toBeVisible();
  await nextPoll(page);
  await expect(editor.getByText(progressUnknown)).toBeVisible();
  await expect(editor.getByRole('alert')).toBeVisible();
  const box = (await progress(editor).boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(36);
  for (const notice of await editor.locator('.notice').all()) {
    const { y, height } = (await notice.boundingBox())!;
    expect(y + height).toBeLessThanOrEqual(box.y);
  }
});

for (const [locale, message, button] of [
  [
    'es',
    'No se puede seguir esta publicación porque la web ya no la reconoce, así que esos cambios pueden no llegar a verse. Recarga la página para ver lo que hay publicado y avisa a quien mantiene tu web. Tu borrador está a salvo.',
    'Publicar',
  ],
  [
    'en',
    "This Publish can't be followed because the site no longer knows it, so those changes may not go live. Reload the page to see what is published, and tell your developer. Your draft is safe.",
    'Publish',
  ],
] as const) {
  test(`a commit the server does not know as a Publish stops being followed, and says so in ${locale} (P5)`, async ({
    page,
    openEditor,
    bar,
    editor,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', followingOnly);
    await page.clock.install();
    const api = await mockPublishApi(page);
    api.publish = { status: 202, json: { sha, version: '1.4.3' } };
    api.status[sha] = { status: 404 };
    await openEditor({ session: { ...ana, locale } });
    await type(page, 'hero.title', 'Otro título');

    await publishButton(bar, button).click();
    await expect(progress(editor)).toBeVisible();

    await nextPoll(page);
    await expect(progress(editor)).toHaveCount(0);
    await expect(editor.getByRole('alert').locator('span')).toHaveText(message);

    // Told once, and what it published no longer stands on the page: the
    // next Change's value before is the one the page was built with.
    await page.reload();
    await expect(bar).toBeVisible();
    await expect(progress(editor)).toHaveCount(0);
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(field(page, 'hero.title')).toHaveText(title);
    await type(page, 'hero.title', 'Tercer título');
    expect(await keptDraft(page)).toEqual([
      { path: 'hero.title', before: title, after: 'Tercer título' },
    ]);
  });
}

test('a Field published before its List moved is not put on the Item now at its index (P8)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  // Built with two Items that read the same.
  const same = 'Fisioterapia deportiva';
  const buildWith = await serveBuild(page, (html) =>
    html.replaceAll('Suelo pélvico', same),
  );
  await openEditor();

  await editAll(page, 'services.0');
  await page.keyboard.type('Masaje');
  await page.keyboard.press('Tab');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');

  // With the first in progress, the Item it changed moves.
  await focusField(page, 'services.0');
  await editor.getByRole('button', { name: 'Bajar «Masaje»' }).click();
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  api.publish = { status: 202, json: { sha: newer, version: '1.4.4' } };
  api.status[newer] = stageOf('validating', '1.4.4');
  await publishButton(bar).click();
  await expect(progress(editor)).toHaveAccessibleName(
    'Publicación de la versión 1.4.4',
  );
  const services = [same, 'Masaje', 'Punción seca'];
  const shown = async () => (await texts(page, 'services')).slice(0, 3);
  await expect.poll(shown).toEqual(services);

  // Neither is built yet: both are still put on the page.
  await page.reload();
  await expect(bar).toBeVisible();
  await expect.poll(shown).toEqual(services);

  // A build with both: the first Field is at its index again, reading what
  // its Change had as the value before.
  buildWith((html) => html.replaceAll('Suelo pélvico', 'Masaje'));
  await page.reload();
  await expect(bar).toBeVisible();

  await expect.poll(shown).toEqual(services);
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  await editAll(page, 'services.0');
  await page.keyboard.type('Pilates');
  await page.keyboard.press('Tab');
  expect(await keptDraft(page)).toEqual([
    { path: 'services.0', before: same, after: 'Pilates' },
  ]);
});

test('a Publish that is lost forgets what it published on its own page, not on the one being looked at (P5)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  const api = await mockPublishApi(page);
  await serveOtherPage(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  await type(page, 'hero.title', 'Título de la portada');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();

  // Another page publishes, and the bar follows that one, on any page.
  api.publish = { status: 202, json: { sha: newer, version: '1.4.4' } };
  api.status[newer] = stageOf('validating', '1.4.4');
  await page.goto('/otra');
  await expect(bar).toBeVisible();
  await expect(field(page, 'hero.title')).toHaveText(title);
  await type(page, 'hero.title', 'Título de la otra');
  await publishButton(bar).click();
  await expect(progress(editor)).toHaveAccessibleName(
    'Publicación de la versión 1.4.4',
  );

  // Back on the first page, the server no longer knows the one followed.
  api.status[newer] = { status: 404 };
  await page.goto('/');
  await expect(bar).toBeVisible();
  // Asked at once on the page load.
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(progress(editor)).toHaveCount(0);

  // What this page published is on its way, so it still stands.
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(field(page, 'hero.title')).toHaveText('Título de la portada');

  // What the lost one published is not, on the page it was published from.
  await page.goto('/otra');
  await expect(bar).toBeVisible();
  await expect(field(page, 'hero.title')).toHaveText(title);
});

test('a Publish that is lost leaves what an earlier one published on the same page (P5, P8)', async ({
  page,
  openEditor,
  bar,
  editor,
}) => {
  await page.clock.install();
  const api = await mockPublishApi(page);
  api.publish = { status: 202, json: { sha, version: '1.4.3' } };
  api.status[sha] = stageOf('validating');
  await openEditor();
  const lead = (await field(page, 'hero.lead').textContent())!.trim();
  await type(page, 'hero.title', 'Otro título');
  await publishButton(bar).click();
  await expect(progress(editor)).toBeVisible();

  await type(page, 'hero.lead', 'Otra entradilla');
  api.publish = { status: 202, json: { sha: newer, version: '1.4.4' } };
  api.status[newer] = { status: 404 };
  await publishButton(bar).click();
  await expect(progress(editor)).toHaveAccessibleName(
    'Publicación de la versión 1.4.4',
  );
  await nextPoll(page);
  await expect(editor.getByRole('alert')).toBeVisible();

  await page.reload();
  await expect(bar).toBeVisible();

  await expect(field(page, 'hero.title')).toHaveText('Otro título');
  await expect(field(page, 'hero.lead')).toHaveText(lead);
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
