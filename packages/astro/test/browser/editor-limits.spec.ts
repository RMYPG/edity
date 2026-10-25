// L1 to L7: the Client sees each Field's Limits while typing, measured on
// the page as it renders, and only Fields changed in the Draft can block
// Publish.
import type { Locator, Page } from '@playwright/test';
import {
  amber,
  ana,
  editAll,
  editAtEnd,
  expect,
  field,
  lines,
  red,
  test,
} from './editor.js';
import { wideFont } from './wide-font.js';

const word = ' WWWWW';

/**
 * Types `word` at the caret until `block` takes more than `max` lines, then
 * takes the last one back if `fill`: about the most text that fits in `max`
 * lines.
 */
async function typeLines(
  page: Page,
  block: Locator,
  max: number,
  { fill = false, word: typed = word } = {},
): Promise<void> {
  while ((await lines(block)) <= max) await page.keyboard.type(typed);
  if (!fill) return;
  for (let key = 0; key < typed.length; key++) {
    await page.keyboard.press('Backspace');
  }
  expect(await lines(block)).toBe(max);
}

function isNarrow(page: Page): boolean {
  return page.viewportSize()!.width < 600;
}

test.describe('visible characters (L1, L3, L4)', () => {
  test('count as visible characters, emoji and accents included', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    const publish = bar.getByRole('button', { name: 'Publicar' });
    const counter = editor.locator('.counter');
    // 24 visible characters at most, and one line.
    const call = await editAll(page, 'contact.call');

    // 19: under 80% of the Limit, though 25 UTF-16 code units long.
    await page.keyboard.type('Ñoño 👍🏽 pídelo 🇪🇸 ya!');
    await expect(counter).toHaveCount(0);
    // A decomposed ñ, an n and a combining tilde, is one more.
    await page.keyboard.type('ñ');
    await expect(counter).toHaveText('20/24');
    // A family is one more, though 11 code units long.
    await page.keyboard.type('👨‍👩‍👧‍👦abc');
    await expect(counter).toHaveText('24/24');
    await expect(call).not.toHaveAttribute('aria-invalid');
    await expect(publish).toBeEnabled();

    await page.keyboard.type('é');

    // Typing on is never blocked (L3).
    await expect(call).toHaveText('Ñoño 👍🏽 pídelo 🇪🇸 ya!ñ👨‍👩‍👧‍👦abcé');
    await expect(counter).toHaveText('25/24 · sobra 1');
    await expect(call).toHaveCSS('outline-color', red);
    await expect(call).toHaveAttribute('aria-invalid', 'true');
    await expect(publish).toBeDisabled();

    await page.keyboard.press('Backspace');
    await expect(counter).toHaveText('24/24');
    await expect(call).not.toHaveAttribute('aria-invalid');
    await expect(publish).toBeEnabled();
  });

  test('the counter shows from 80% of the Limit on while the Field is edited, and always once over it (L4)', async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor();
    const counter = editor.locator('.counter');
    // 24 visible characters at most: 80% is 20. The link is the Field.
    const cta = await editAtEnd(page, 'hero.cta');
    await page.keyboard.type(' ya!');
    await expect(cta).toHaveText('Reserva tu cita ya!');
    await expect(counter).toHaveCount(0);

    await page.keyboard.type('?');
    await expect(counter).toHaveText('20/24');
    // Leaving the Field, a counter under the Limit goes.
    await page.keyboard.press('Enter');
    await expect(counter).toHaveCount(0);

    await editAtEnd(page, 'hero.cta');
    await expect(counter).toHaveText('20/24');
    await page.keyboard.type(' ahora');
    await expect(counter).toHaveText('26/24 · sobran 2');
    await page.keyboard.press('Enter');
    await expect(counter).toHaveText('26/24 · sobran 2');
    // Just below its Field.
    const [link, box] = await Promise.all([
      cta.boundingBox(),
      counter.boundingBox(),
    ]);
    expect(box!.y).toBeGreaterThan(link!.y + link!.height);
    expect(box!.y).toBeLessThan(link!.y + link!.height + 20);
  });

  test("the counter is in the Client's language", async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor({ session: { ...ana, locale: 'en' } });

    await editAll(page, 'contact.call');
    await page.keyboard.type('Call us now, all day long');

    await expect(editor.locator('.counter')).toHaveText('25/24 · 1 too many');
  });
});

test.describe('lines (L2)', () => {
  test('a Field that takes more lines than its Limit on the page turns red', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    const publish = bar.getByRole('button', { name: 'Publicar' });
    const counter = editor.locator('.counter');
    // 2 lines at most, and 3 on a narrow screen such as a phone's.
    const max = isNarrow(page) ? 3 : 2;
    const title = await editAll(page, 'hero.title');
    await page.keyboard.type('WWWWW');

    await typeLines(page, title, max);

    await expect(title).toHaveCSS('outline-color', red);
    // What it is over comes first.
    await expect(counter.locator('span').first()).toHaveText(
      `${max + 1}/${max} líneas · sobra 1`,
    );
    await expect(publish).toBeDisabled();

    for (let key = 0; key < word.length; key++) {
      await page.keyboard.press('Backspace');
    }
    await expect(counter).toHaveCount(0);
    await expect(title).not.toHaveCSS('outline-color', red);
    await expect(publish).toBeEnabled();
  });

  test('lines are counted on inline elements too', async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor();
    // A <span> in an <li>, after a tick: 2 lines at most.
    const feature = await editAll(page, 'plans.0.features.0');
    const item = page.locator('[data-edity-item="plans.0.features.0"]');
    await page.keyboard.type('WWWWW');

    await typeLines(page, item, 2);

    await expect(feature).toHaveCSS('outline-color', red);
    await expect(editor.locator('.counter')).toContainText(
      '3/2 líneas · sobra 1',
    );
  });

  test('under 600 px the narrow line Limit holds, by default', async ({
    page,
    openEditor,
    editor,
  }) => {
    // The fixture's own CSS changes at 480 px, so the page looks the same.
    await page.setViewportSize({ width: 599, height: 800 });
    await openEditor();
    const counter = editor.locator('.counter');
    const title = await editAll(page, 'hero.title');
    await page.keyboard.type('WWWWW');
    await typeLines(page, title, 3, { fill: true });
    await page.keyboard.press('Enter');
    await expect(counter).toHaveCount(0);

    await page.setViewportSize({ width: 601, height: 800 });

    expect(await lines(title)).toBe(3);
    await expect(counter.locator('span').first()).toHaveText(
      '3/2 líneas · sobra 1',
    );
    await expect(title).toHaveCSS('outline-color', red);

    await page.setViewportSize({ width: 599, height: 800 });

    await expect(counter).toHaveCount(0);
    await expect(title).not.toHaveCSS('outline-color', red);
  });
});

test('a number Field out of its range, or with too many decimals, turns red (L5)', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await openEditor();
  const publish = bar.getByRole('button', { name: 'Publicar' });
  const counter = editor.locator('.counter');
  // From 0 to 500, with 2 decimals.
  const price = await editAll(page, 'visit.price');

  await page.keyboard.type('500,01');
  await expect(counter).toHaveText('Máximo 500');
  await expect(price).toHaveCSS('outline-color', red);
  await expect(publish).toBeDisabled();

  await page.keyboard.press('Backspace');
  await expect(counter).toHaveCount(0);
  await expect(publish).toBeEnabled();

  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('19,999');
  await expect(counter).toHaveText('Máximo 2 decimales');
  await expect(publish).toBeDisabled();
  // It stays red once the Client leaves it.
  await page.keyboard.press('Enter');
  await expect(price).toHaveText('19,999');
  await expect(price).toHaveCSS('outline-color', red);

  // Whole numbers only: in Spain, 1.5 is not one and a half thousand.
  await editAll(page, 'stats.patients');
  await page.keyboard.type('1.5');
  // In page order: the patients come before the price.
  await expect(editor.locator('.counter.over')).toHaveText([
    'Sin decimales',
    'Máximo 2 decimales',
  ]);

  await editAll(page, 'visit.price');
  await page.keyboard.type('40,5');
  await editAll(page, 'stats.patients');
  await page.keyboard.type('15');
  await expect(counter).toHaveCount(0);
  await expect(publish).toBeEnabled();
});

test.describe('checked again (L6)', () => {
  test('when the width changes', async ({ page, openEditor, editor }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openEditor();
    const counter = editor.locator('.counter');
    const title = await editAll(page, 'hero.title');
    await page.keyboard.type('WWWWW');
    // As much as 2 lines hold, in short words, which takes 3 lines at
    // 620 px.
    await typeLines(page, title, 2, { fill: true, word: ' WW' });
    await page.keyboard.press('Enter');
    await expect(counter).toHaveCount(0);

    await page.setViewportSize({ width: 620, height: 800 });

    await expect(title).toHaveCSS('outline-color', red);
    await expect(counter.locator('span').first()).toHaveText(
      /^[3-9]\/2 líneas · sobran? \d$/,
    );

    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(counter).toHaveCount(0);
    await expect(title).not.toHaveCSS('outline-color', red);
  });

  test('when a font finishes loading', async ({ page, openEditor, editor }) => {
    let arrive!: () => void;
    const arrived = new Promise<void>((resolve) => (arrive = resolve));
    await page.route('**/late-font.ttf', async (route) => {
      await arrived;
      await route.fulfill({ body: wideFont(), contentType: 'font/ttf' });
    });
    await openEditor();
    const counter = editor.locator('.counter');
    const title = field(page, 'hero.title');
    // A web font, much wider than the system font, that is late.
    await page.addStyleTag({
      content: `
        @font-face { font-family: Late; src: url(/late-font.ttf); font-display: swap; }
        h1 { font-family: Late, system-ui, sans-serif; }
      `,
    });
    await editAtEnd(page, 'hero.title');
    await page.keyboard.type(' ya');
    await page.keyboard.press('Enter');
    await expect(counter).toHaveCount(0);

    // Any check the Editor has scheduled has run.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await expect(title).not.toHaveAttribute('data-edity-limit');

    arrive();

    await expect
      .poll(() => page.evaluate(() => document.fonts.check('16px Late', 'a')))
      .toBe(true);
    await expect(title).toHaveCSS('outline-color', red);
    await expect(counter).toHaveText(/^\d+\/[23] líneas · sobran? \d+$/);
  });
});

test.describe('content over a Limit as published (L7)', () => {
  test.beforeEach(async ({ page }) => {
    // As if the Site's CSS had changed since the title was written: it now
    // takes more lines than its Limit.
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        await route.fulfill({
          response,
          body: html.replace(
            '</head>',
            '<style>h1 { max-width: 8ch !important; }</style></head>',
          ),
        });
      },
    );
  });

  test('shows a warning, and only blocks Publish once the Draft changes it', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    const publish = bar.getByRole('button', { name: 'Publicar' });
    const counter = editor.locator('.counter');
    const title = field(page, 'hero.title');

    await expect(title).toHaveCSS('outline-color', amber);
    await expect(counter).toHaveText(
      /^\d+\/[23] líneas · sobran? \d+ · ya publicado así$/,
    );
    await expect(title).not.toHaveAttribute('aria-invalid');

    // A Change elsewhere can be published.
    await editAtEnd(page, 'hero.lead');
    await page.keyboard.type(' ¡Ven!');
    await page.keyboard.press('Enter');
    await expect(publish).toBeEnabled();

    // Changing the title, which is still over its Limit, makes it red.
    await editAtEnd(page, 'hero.title');
    await page.keyboard.type(' ya');
    await expect(title).toHaveCSS('outline-color', red);
    await expect(counter).toHaveText(/^\d+\/[23] líneas · sobran? \d+$/);
    await expect(publish).toBeDisabled();

    // As built again, it is only a warning.
    for (let key = 0; key < 3; key++) await page.keyboard.press('Backspace');
    await expect(title).toHaveCSS('outline-color', amber);
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
    await expect(publish).toBeEnabled();
  });

  test('the visitor view shows no Limits (P7)', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    const title = field(page, 'hero.title');
    await expect(title).toHaveAttribute('data-edity-limit', 'warning');

    await bar.getByRole('button', { name: 'Vista de visitante' }).click();

    await expect(page.locator('[data-edity-limit]')).toHaveCount(0);
    await expect(editor.locator('.counter')).toHaveCount(0);
    await expect(title).toHaveCSS('outline-style', 'none');

    await editor.getByRole('button', { name: 'Volver a editar' }).click();

    await expect(title).toHaveCSS('outline-color', amber);
    await expect(editor.locator('.counter')).toHaveCount(1);
  });
});
