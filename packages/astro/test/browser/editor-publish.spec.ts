// P3 to P5, P8 and A3: Publish sends the Draft, and the Client follows the
// Release it becomes. edity-server is mocked with page.route().
import type { Locator, Page } from '@playwright/test';
import {
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
