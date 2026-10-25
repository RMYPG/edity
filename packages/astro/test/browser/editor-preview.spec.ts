// P6 and L6: a phone-width preview shows the Draft at 390 px, with the
// Site's own CSS for that width, and Limits checked there.
import type { FrameLocator, Locator, Page } from '@playwright/test';
import { expect, recordRequests, test } from './editor.js';

/** The outline of a Field the Draft changed over a Limit (L3). */
const red = 'rgb(220, 38, 38)';

const built = {
  lead: 'Sesiones individuales de una hora, con un plan pensado para tu lesión y para tu ritmo de vida.',
  cta: 'Reserva tu cita',
};

/** The elements of `page`, or of the preview's page, that show `path`. */
function field(page: Page | FrameLocator, path: string): Locator {
  return page.locator(`[data-edity-field="${path}"]`);
}

/** Clicks into the Field at `path` and selects its text. */
async function editAll(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  await locator.click();
  await expect(locator).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  return locator;
}

/** Clicks into the Field at `path` and puts the caret at its end. */
async function editAtEnd(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  await locator.click();
  await expect(locator).toBeFocused();
  await locator.evaluate((element) => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  return locator;
}

/** The lines a block element takes, from its height and line height. */
function lines(block: Locator): Promise<number> {
  return block.evaluate((element) =>
    Math.round(
      (element as HTMLElement).offsetHeight /
        parseFloat(getComputedStyle(element).lineHeight),
    ),
  );
}

test.describe('on a wide screen', () => {
  test.skip(({ isMobile }) => isMobile, 'a phone shows the page at its width');

  test('the preview shows the Draft at 390 px, as the Client edits it (P6)', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    const requests = recordRequests(page);
    await openEditor();
    const toggle = bar.getByRole('button', { name: 'Vista de móvil' });
    await editAtEnd(page, 'hero.lead');
    await page.keyboard.type(' ¡Ven!');
    await editAll(page, 'stats.patients');
    await page.keyboard.type('15000');
    // Shown twice, once in a link (E7).
    await editAll(page, 'brand.name');
    await page.keyboard.type('Fisio Norte');
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const preview = editor.locator('iframe[data-edity-preview]');
    await expect(preview).toBeVisible();
    const phone = preview.contentFrame();
    await expect(field(phone, 'hero.lead')).toHaveText(`${built.lead} ¡Ven!`);
    // Formatted as the template formats it.
    await expect(field(phone, 'stats.patients')).toHaveText('15.000');
    await expect(field(phone, 'brand.name')).toHaveText([
      'Fisio Norte',
      'Fisio Norte',
    ]);
    // At a phone's width, where the Site's own CSS for it applies.
    expect(
      await phone.locator('html').evaluate((html) => ({
        width: innerWidth,
        layout: html.clientWidth,
        narrow: matchMedia('(max-width: 480px)').matches,
      })),
    ).toEqual({ width: 390, layout: 390, narrow: true });
    await expect(phone.locator('h1')).toHaveCSS('font-size', '36px');
    // Shown, not edited: the Editor does not start in it.
    await expect(phone.getByRole('region')).toHaveCount(0);
    await expect(phone.locator('[contenteditable]')).toHaveCount(0);

    // It follows the Draft while the Client types.
    await editAll(page, 'hero.cta');
    await page.keyboard.type('Pide cita');
    await expect(field(phone, 'hero.cta')).toHaveText('Pide cita');
    await editAll(page, 'stats.patients');
    await page.keyboard.type('12000');
    await expect(field(phone, 'stats.patients')).toHaveText('12.000');

    // And shows the content as published once the Draft is discarded.
    await bar.getByRole('button', { name: 'Descartar' }).click();
    await expect(field(phone, 'hero.lead')).toHaveText(built.lead);
    await expect(field(phone, 'hero.cta')).toHaveText(built.cta);
    await expect(field(phone, 'brand.name')).toHaveText([
      'Fisio Sandbox',
      'Fisio Sandbox',
    ]);
    // The preview asked the server for nothing.
    expect(requests.filter((path) => path.startsWith('/_edity/api/'))).toEqual([
      '/_edity/api/session',
    ]);

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(preview).toHaveCount(0);
  });

  test('a line Limit that only breaks on narrow screens shows in the preview (L6)', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    // The title as wide as the page, so it holds twice as much on each
    // line as it does on a phone.
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        await route.fulfill({
          response,
          body: html.replace(
            '</head>',
            '<style>h1 { max-width: none !important; }</style></head>',
          ),
        });
      },
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await openEditor();
    const publish = bar.getByRole('button', { name: 'Publicar' });
    await bar.getByRole('button', { name: 'Vista de móvil' }).click();
    const phone = editor.locator('iframe[data-edity-preview]').contentFrame();
    const narrowTitle = field(phone, 'hero.title');
    await expect(narrowTitle).toHaveText(
      'Fisioterapia que te devuelve el movimiento',
    );
    // 2 lines at most, and 3 on a narrow screen such as a phone's.
    const title = await editAtEnd(page, 'hero.title');

    while ((await lines(narrowTitle)) <= 3) await page.keyboard.type(' WWWWW');
    await page.keyboard.press('Enter');

    // Within its Limit on the page.
    expect(await lines(title)).toBeLessThanOrEqual(2);
    await expect(title).not.toHaveAttribute('data-edity-limit');
    await expect(editor.locator('.counter')).toHaveCount(0);
    // Over it in the preview, which says so.
    await expect(narrowTitle).toHaveCSS('outline-color', red);
    await expect(narrowTitle).toHaveAttribute('aria-invalid', 'true');
    await expect(phone.locator('edity-root .counter span').first()).toHaveText(
      '4/3 líneas · sobra 1',
    );
    await expect(publish).toBeDisabled();

    // Closing the preview leaves the page's own width to check.
    await bar.getByRole('button', { name: 'Vista de móvil' }).click();

    await expect(publish).toBeEnabled();
  });

  test('the preview shows the Draft again when its page loads again', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    await editAll(page, 'hero.cta');
    await page.keyboard.type('Pide cita');
    await bar.getByRole('button', { name: 'Vista de móvil' }).click();
    const preview = editor.locator('iframe[data-edity-preview]');
    const phone = preview.contentFrame();
    await expect(field(phone, 'hero.cta')).toHaveText('Pide cita');
    const loaded = await preview.evaluateHandle(
      (frame) => (frame as HTMLIFrameElement).contentDocument,
    );

    // The footer's link goes to the same page.
    await phone.locator('footer a').click();

    await expect
      .poll(() =>
        preview.evaluate(
          (frame, before) =>
            (frame as HTMLIFrameElement).contentDocument !== before,
          loaded,
        ),
      )
      .toBe(true);
    await expect(field(phone, 'hero.cta')).toHaveText('Pide cita');
  });

  test('List Changes in the Draft leave the preview, the page and the Editor working', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openEditor();
    // A List Change, and a Field Change after it in the Draft.
    await editAtEnd(page, 'services.0');
    await editor
      .getByRole('button', { name: 'Añadir elemento', exact: true })
      .click();
    await expect(field(page, 'services.4')).toBeFocused();
    await page.keyboard.type('Masaje');
    await editAll(page, 'hero.cta');
    await page.keyboard.type('Pide cita');
    await page.keyboard.press('Enter');
    const count = bar.getByRole('status');
    await expect(count).toHaveText('2 cambios');

    await bar.getByRole('button', { name: 'Vista de móvil' }).click();

    const phone = editor.locator('iframe[data-edity-preview]').contentFrame();
    // The Field Change shows, past the List Change.
    await expect(field(phone, 'hero.cta')).toHaveText('Pide cita');
    // The page keeps its new Item, and the Draft both Changes.
    await expect(field(page, 'services.4')).toHaveText('Masaje');
    await expect(count).toHaveText('2 cambios');

    // The Lists are still edited as before, with the preview open.
    await editAtEnd(page, 'services.4');
    await page.keyboard.type(' deportivo');
    await expect(field(page, 'services.4')).toHaveText('Masaje deportivo');
    await editAll(page, 'hero.cta');
    await page.keyboard.type('Reserva ya');
    await expect(field(phone, 'hero.cta')).toHaveText('Reserva ya');
    await expect(count).toHaveText('2 cambios');

    await bar.getByRole('button', { name: 'Descartar' }).click();

    await expect(field(page, 'services.4')).toHaveCount(0);
    await expect(field(phone, 'hero.cta')).toHaveText(built.cta);
    await expect(count).toHaveText('Sin cambios');
    expect(errors).toEqual([]);
  });

  test('the visitor view hides the preview, and editing brings it back (P7)', async ({
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    await bar.getByRole('button', { name: 'Vista de móvil' }).click();
    const preview = editor.locator('iframe[data-edity-preview]');
    await expect(preview).toBeVisible();

    await bar.getByRole('button', { name: 'Vista de visitante' }).click();

    await expect(preview).toHaveCount(0);

    await editor.getByRole('button', { name: 'Volver a editar' }).click();

    await expect(preview).toBeVisible();
    await expect(
      bar.getByRole('button', { name: 'Vista de móvil' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

test('on a phone, which shows the page at its width, the bar offers no preview', async ({
  page,
  openEditor,
  bar,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor();

  await expect(bar.getByRole('button', { name: 'Vista de móvil' })).toHaveCount(
    0,
  );
  await expect(
    bar.getByRole('button', { name: 'Vista de visitante' }),
  ).toBeVisible();
});
