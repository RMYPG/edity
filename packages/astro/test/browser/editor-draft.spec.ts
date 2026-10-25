// P2 and P3: the Draft is kept in the browser and comes back after a reload
// or a closed tab, without the Changes whose Field or List the page no
// longer has, and each Change keeps the value before that the Client first
// changed. The phone preview shows it all, its Lists included (P6).
import type { FrameLocator, Locator, Page } from '@playwright/test';
import { ana, expect, keepDraft, keptDraft, test } from './editor.js';

/** The fixture page as built, as `src/content/home.json` holds it. */
const built = {
  brand: 'Fisio Sandbox',
  cta: 'Reserva tu cita',
  services: [
    'Fisioterapia deportiva',
    'Suelo pélvico',
    'Punción seca',
    'Rehabilitación tras cirugía 🦴',
  ],
  plans: ['Básico', 'Completo'],
  completo: [
    'Cuatro sesiones al mes',
    'Plan de ejercicios en casa',
    'Seguimiento por WhatsApp',
  ],
} as const;

/** The Site's elements that show the Field at `path`, on the page or in the preview. */
function field(page: Page | FrameLocator, path: string): Locator {
  return page.locator(`[data-edity-field="${path}"]`);
}

/** The text of the first Field of each Item of the List at `path`. */
function texts(page: Page | FrameLocator, path: string): Promise<string[]> {
  return page
    .locator(`[data-edity-list="${path}"]`)
    .evaluate((list) =>
      [...list.children]
        .filter((child) => child.hasAttribute('data-edity-item'))
        .map(
          (child) =>
            (child.matches('[data-edity-field]')
              ? child
              : child.querySelector('[data-edity-field]')
            )?.textContent ?? '',
        ),
    );
}

/** Every path in the List at `path`, templates included, in document order. */
function paths(page: Page | FrameLocator, path: string): Promise<string[]> {
  return page.locator(`[data-edity-list="${path}"]`).evaluate((list) => {
    const found: string[] = [];
    const walk = (root: ParentNode) => {
      for (const element of root.querySelectorAll('*')) {
        if (element.parentElement?.closest('template')) continue;
        for (const name of [
          'data-edity-item',
          'data-edity-field',
          'data-edity-list',
          'data-edity-template',
        ]) {
          const value = element.getAttribute(name);
          if (value !== null) found.push(`${name.slice(11)}=${value}`);
        }
        if (element.localName === 'template') {
          walk((element as HTMLTemplateElement).content);
        }
      }
    };
    walk(list);
    return found;
  });
}

/** Clicks near the start of the Field at `path`, so its Item's controls show. */
async function focusField(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  const box = (await locator.boundingBox())!;
  await locator.click({ position: { x: 4, y: box.height / 2 } });
  await expect(locator).toBeFocused();
  return locator;
}

/** Clicks into the Field at `path` and selects its text. */
async function editAll(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  await locator.click();
  await expect(locator).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  return locator;
}

async function caretAtEnd(locator: Locator): Promise<Locator> {
  await locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  return locator;
}

test('reloading mid-edit restores every Change and the count (P2)', async ({
  page,
  openEditor,
  editor,
  bar,
  isMobile,
}) => {
  await openEditor();
  const count = bar.getByRole('status');
  // A text Field shown twice (E7), and a number Field.
  await editAll(page, 'brand.name');
  await page.keyboard.type('Fisio Norte');
  await page.keyboard.press('Enter');
  await editAll(page, 'stats.patients');
  await page.keyboard.type('15000');
  await page.keyboard.press('Enter');
  // A Field in a List as built, and a List inside one of its Items.
  await editAll(page, 'plans.0.price');
  await page.keyboard.type('21,5');
  await page.keyboard.press('Enter');
  await focusField(page, 'plans.1.features.2');
  await editor
    .getByRole('button', { name: 'Añadir elemento a «Completo»' })
    .click();
  await page.keyboard.type('Sin permanencia');
  // A List whose Items moved, with a new one.
  await focusField(page, 'services.3');
  await editor
    .getByRole('button', { name: `Subir «${built.services[3]}»` })
    .click();
  await caretAtEnd(await focusField(page, 'services.3'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('Masaje');
  const services = [
    built.services[0],
    built.services[1],
    built.services[3],
    built.services[2],
    'Masaje',
  ];
  await expect.poll(() => texts(page, 'services')).toEqual(services);
  await expect(count).toHaveText('5 cambios');
  const kept = await keptDraft(page);
  expect(kept?.map((change) => change.path)).toEqual([
    'brand.name',
    'stats.patients',
    'plans.0.price',
    'plans.1.features',
    'services',
  ]);

  await page.reload();
  await expect(bar).toBeVisible();

  await expect(count).toHaveText('5 cambios');
  await expect(field(page, 'brand.name')).toHaveText([
    'Fisio Norte',
    'Fisio Norte',
  ]);
  // Formatted as the template formats them.
  await expect(field(page, 'stats.patients')).toHaveText('15.000');
  await expect(field(page, 'plans.0.price')).toHaveText('21,50');
  await expect
    .poll(() => texts(page, 'plans.1.features'))
    .toEqual([...built.completo, 'Sin permanencia']);
  await expect.poll(() => texts(page, 'services')).toEqual(services);
  expect(await keptDraft(page)).toEqual(kept);
  await expect(editor.getByText(/ya no se aplica/)).toHaveCount(0);

  // Edited as before the reload, the new Items too.
  const added = await focusField(page, 'services.4');
  await expect(added).toHaveAttribute('contenteditable', 'plaintext-only');
  await caretAtEnd(added);
  await page.keyboard.type(' deportivo');
  await expect(added).toHaveText('Masaje deportivo');
  await expect(count).toHaveText('5 cambios');
  await expect(bar.getByRole('button', { name: 'Publicar' })).toBeEnabled();

  // The preview shows the restored Draft, its Lists included (P6).
  if (!isMobile) {
    const toggle = bar.getByRole('button', { name: 'Vista de móvil' });
    await toggle.click();
    const phone = editor.locator('iframe[data-edity-preview]').contentFrame();
    await expect
      .poll(() => texts(phone, 'services'))
      .toEqual([...services.slice(0, 4), 'Masaje deportivo']);
    await expect
      .poll(() => texts(phone, 'plans.1.features'))
      .toEqual([...built.completo, 'Sin permanencia']);
    await expect(field(phone, 'plans.0.price')).toHaveText('21,50');
    await toggle.click();
  }

  // Discard forgets the Draft kept in the browser too.
  await bar.getByRole('button', { name: 'Descartar' }).click();
  await expect(count).toHaveText('Sin cambios');
  expect(await keptDraft(page)).toBeUndefined();
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(count).toHaveText('Sin cambios');
  await expect(field(page, 'brand.name')).toHaveText([
    built.brand,
    built.brand,
  ]);
  expect(await texts(page, 'services')).toEqual(built.services);
});

test('the Draft comes back in a new tab once the one it was made in is closed (P2)', async ({
  context,
  page,
  openEditor,
  bar,
}) => {
  await openEditor();
  await editAll(page, 'hero.cta');
  await page.keyboard.type('Pide cita');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');

  await page.close();
  const tab = await context.newPage();
  await tab.route('**/_edity/api/session', (route) =>
    route.fulfill({ json: ana }),
  );
  await tab.goto('/');

  const editor = tab.locator('edity-root');
  await expect(editor.getByRole('status')).toHaveText('1 cambio');
  await expect(field(tab, 'hero.cta')).toHaveText('Pide cita');
});

test('a Draft with a Change to a removed Field restores the rest and shows "1 change no longer applies" (P2)', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  const cta = { path: 'hero.cta', before: built.cta, after: 'Pide cita' };
  await keepDraft(page, [
    // A Field the Site no longer has.
    { path: 'hero.subtitle', before: 'En tu casa', after: 'Cerca de ti' },
    cta,
  ]);

  await openEditor();

  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(field(page, 'hero.cta')).toHaveText('Pide cita');
  const notice = editor.getByText('1 cambio ya no se aplica');
  await expect(notice).toBeVisible();
  expect(await keptDraft(page)).toEqual([cta]);

  await editor.getByRole('button', { name: 'Entendido' }).click();
  await expect(notice).toHaveCount(0);

  // Once dropped, it is gone for good.
  await page.reload();
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(editor.getByText(/ya no se aplica/)).toHaveCount(0);
});

test('Changes to Items and Lists the page no longer has are dropped too, and the notice goes once the Client edits', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await keepDraft(page, [
    // An Item past the four the List has now.
    { path: 'services.6', before: 'Pilates', after: 'Pilates suave' },
    // A List that is a Field now.
    { path: 'hero.title', before: ['Uno'], after: ['Uno', 'Dos'] },
    { path: 'services.1', before: built.services[1], after: 'Suelo' },
  ]);

  await openEditor();

  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(field(page, 'services.1')).toHaveText('Suelo');
  const notice = editor.getByText('2 cambios ya no se aplican');
  await expect(notice).toBeVisible();

  await caretAtEnd(await focusField(page, 'services.1'));
  await page.keyboard.type(' pélvico');

  await expect(notice).toHaveCount(0);
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
});

test('a restored Change keeps the value before that the Client first changed, for the server to tell a Conflict (V2)', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  // Made before a newer Release changed these values.
  const older = {
    cta: 'Pide tu cita',
    services: ['Fisioterapia deportiva', 'Suelo pélvico', 'Punción seca'],
  };
  await keepDraft(page, [
    { path: 'hero.cta', before: older.cta, after: 'Reserva ya' },
    {
      path: 'services',
      before: older.services,
      after: [...built.services, 'Masaje'],
    },
  ]);

  await openEditor();
  await expect(bar.getByRole('status')).toHaveText('2 cambios');
  await expect(field(page, 'hero.cta')).toHaveText('Reserva ya');
  await expect
    .poll(() => texts(page, 'services'))
    .toEqual([...built.services, 'Masaje']);

  // Edited again: a Field, an Item's text and the List's order.
  await caretAtEnd(await editAll(page, 'hero.cta'));
  await page.keyboard.type(' mismo');
  await page.keyboard.press('Enter');
  await caretAtEnd(await focusField(page, 'services.4'));
  await page.keyboard.type(' deportivo');
  await focusField(page, 'services.0');
  await editor
    .getByRole('button', { name: `Bajar «${built.services[0]}»` })
    .click();

  await expect
    .poll(() => keptDraft(page))
    .toEqual([
      { path: 'hero.cta', before: older.cta, after: 'Reserva ya mismo' },
      {
        path: 'services',
        before: older.services,
        after: [
          built.services[1],
          built.services[0],
          built.services[2],
          built.services[3],
          'Masaje deportivo',
        ],
      },
    ]);
  await expect(bar.getByRole('status')).toHaveText('2 cambios');

  // Discard puts the page back as built, not as it was before.
  await bar.getByRole('button', { name: 'Descartar' }).click();
  await expect(field(page, 'hero.cta')).toHaveText(built.cta);
  await expect.poll(() => texts(page, 'services')).toEqual(built.services);
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
});

test.describe('in the phone preview', () => {
  test.skip(({ isMobile }) => isMobile, 'a phone shows the page at its width');

  test('List Changes show as on the page, and only new and edited Items count as changed (P6, L7)', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    // Services only 8 characters wide on a phone, so the built ones break
    // their 1-line Limit there as published.
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        await route.fulfill({
          response,
          body: html.replace(
            '</head>',
            '<style>@media (max-width: 480px) { .service { max-width: 8ch } }</style></head>',
          ),
        });
      },
    );
    // Wide enough that the preview leaves the List controls clear.
    await page.setViewportSize({ width: 1920, height: 900 });
    await openEditor();
    const publish = bar.getByRole('button', { name: 'Publicar' });
    await bar.getByRole('button', { name: 'Vista de móvil' }).click();
    const phone = editor.locator('iframe[data-edity-preview]').contentFrame();
    await expect(field(phone, 'services.3')).toHaveAttribute(
      'data-edity-limit',
      'warning',
    );

    // Built Items that move show as published, in the preview too.
    await focusField(page, 'services.3');
    await editor
      .getByRole('button', { name: `Subir «${built.services[3]}»` })
      .click();
    const moved = [
      built.services[0],
      built.services[1],
      built.services[3],
      built.services[2],
    ];
    await expect.poll(() => texts(phone, 'services')).toEqual(moved);
    expect(await paths(phone, 'services')).toEqual(
      await paths(page, 'services'),
    );
    await expect(field(phone, 'services.2')).toHaveAttribute(
      'data-edity-limit',
      'warning',
    );
    await expect(phone.locator('[data-edity-limit="over"]')).toHaveCount(0);
    await expect(publish).toBeEnabled();

    // A new Item over its Limit on a phone turns red there.
    await caretAtEnd(await focusField(page, 'services.3'));
    await page.keyboard.press('Enter');
    await page.keyboard.type('Fisioterapia respiratoria');
    await expect
      .poll(() => texts(phone, 'services'))
      .toEqual([...moved, 'Fisioterapia respiratoria']);
    await expect(field(phone, 'services.4')).toHaveAttribute(
      'data-edity-limit',
      'over',
    );
    await expect(phone.locator('[data-edity-limit="over"]')).toHaveCount(1);
    await expect(field(page, 'services.4')).not.toHaveAttribute(
      'data-edity-limit',
    );
    await expect(publish).toBeDisabled();
    // Shown, not edited.
    await expect(phone.locator('[contenteditable]')).toHaveCount(0);

    // A card removed: the List of cards, with the List in it, follows.
    await focusField(page, 'plans.0.name');
    await editor.getByRole('button', { name: 'Quitar «Básico»' }).click();
    await expect.poll(() => texts(phone, 'plans')).toEqual(['Completo']);
    await expect
      .poll(() => texts(phone, 'plans.0.features'))
      .toEqual(built.completo);
    await expect(field(phone, 'plans.0.price')).toHaveText('49,50');
    expect(await paths(phone, 'plans')).toEqual(await paths(page, 'plans'));

    // Discard puts the Lists back as built there too.
    await bar.getByRole('button', { name: 'Descartar' }).click();
    await expect.poll(() => texts(phone, 'services')).toEqual(built.services);
    await expect.poll(() => texts(phone, 'plans')).toEqual(built.plans);
    expect(await paths(phone, 'services')).toEqual(
      await paths(page, 'services'),
    );
    expect(await paths(phone, 'plans')).toEqual(await paths(page, 'plans'));
    await expect(phone.locator('[data-edity-limit="over"]')).toHaveCount(0);
  });
});
