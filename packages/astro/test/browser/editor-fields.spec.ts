// E1 to E8: the Client edits the page's text and number Fields in place,
// and every edit is a Change in the Draft.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './editor.js';

/** The fixture page's built content, as `src/content/home.json` holds it. */
const built = {
  brand: 'Fisio Sandbox',
  title: 'Fisioterapia que te devuelve el movimiento',
  lead: 'Sesiones individuales de una hora, con un plan pensado para tu lesión y para tu ritmo de vida.',
  cta: 'Reserva tu cita',
  call: 'Llámanos',
};

/** The Site's elements that show the Field at `path`. */
function field(page: Page, path: string): Locator {
  return page.locator(`[data-edity-field="${path}"]`);
}

/** Puts the caret at the end of a Field's text. */
async function caretAtEnd(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
}

/** Clicks into the Field at `path` and puts the caret at its end. */
async function editAtEnd(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  await locator.click();
  await expect(locator).toBeFocused();
  await caretAtEnd(locator);
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

/** The path of the focused Field, if a Field is focused. */
function focusedPath(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.edityField,
  );
}

test.describe('marks (E1)', () => {
  test('on a screen that can hover, a Field is marked while the pointer is over it', async ({
    page,
    openEditor,
    hasTouch,
  }) => {
    test.skip(hasTouch, 'touch screens mark every Field');
    await openEditor();
    const title = field(page, 'hero.title');
    const heading = page.getByRole('heading', { name: 'Servicios' });

    await expect(title).toHaveCSS('outline-style', 'none');
    await title.hover();
    await expect(title).toHaveCSS('outline-style', 'dashed');

    // Text that is not a Field gets no mark.
    await heading.hover();
    await expect(heading).toHaveCSS('outline-style', 'none');
    await expect(title).toHaveCSS('outline-style', 'none');
  });

  test('on a touch screen, every Field is faintly marked', async ({
    page,
    openEditor,
    hasTouch,
  }) => {
    test.skip(!hasTouch, 'only touch screens cannot hover');
    await openEditor();

    for (const each of await page.locator('[data-edity-field]').all()) {
      await expect(each).toHaveCSS('outline-style', 'dashed');
    }
    await expect(page.getByRole('heading', { name: 'Servicios' })).toHaveCSS(
      'outline-style',
      'none',
    );
  });
});

test('a click on a Field puts the caret in it, with no popover or sidebar (E2)', async ({
  page,
  openEditor,
  editor,
}) => {
  await openEditor();
  const elements = () =>
    page.evaluate(() => ({
      site: document.body.querySelectorAll('*').length,
      editor: document
        .querySelector('edity-root')!
        .shadowRoot!.querySelectorAll('*').length,
    }));
  const before = await elements();
  const lead = field(page, 'hero.lead');

  await lead.click();

  await expect(lead).toBeFocused();
  expect(
    await lead.evaluate((element) => {
      const selection = getSelection()!;
      return selection.isCollapsed && element.contains(selection.anchorNode);
    }),
  ).toBe(true);
  await page.keyboard.type('¡');
  await expect(lead).toContainText('¡');
  expect(await elements()).toEqual(before);
  await expect(editor.getByRole('dialog')).toHaveCount(0);
});

test.describe('plain text (E3)', () => {
  test('pasted text keeps no formatting, and its line breaks become spaces', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    // Formatted text on two lines, as a Client copies it from a document.
    await page.evaluate(() => {
      const source = document.createElement('div');
      source.id = 'source';
      source.contentEditable = 'true';
      source.innerHTML = '<b>Uno</b><br><i>Dos</i> <a href="/x">tres</a>';
      document.body.append(source);
    });
    await page.locator('#source').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+C');

    const lead = await editAll(page, 'hero.lead');
    await page.keyboard.press('ControlOrMeta+V');

    await expect(lead).toHaveText('Uno Dos tres');
    expect(await lead.evaluate((element) => element.innerHTML)).toBe(
      'Uno Dos tres',
    );
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
  });

  test('whatever else a browser inserts, the Field keeps one line of plain text', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    const lead = await editAll(page, 'hero.lead');

    // As a drop, an extension or a browser's own paste could leave it.
    await lead.evaluate((element) => {
      element.innerHTML = 'Uno<br>Dos <b>tres</b>\ncuatro<br>';
      element.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText' }),
      );
    });

    expect(await lead.evaluate((element) => element.innerHTML)).toBe(
      'Uno Dos tres cuatro',
    );
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
  });

  test('Shift+Enter adds no line break, and extra spaces go when leaving the Field', async ({
    page,
    openEditor,
  }) => {
    await openEditor();

    const title = await editAll(page, 'hero.title');
    await page.keyboard.type('Hola');
    await page.keyboard.press('Shift+Enter');
    await expect(title).not.toBeFocused();
    expect(await title.evaluate((element) => element.innerHTML)).toBe('Hola');

    await editAtEnd(page, 'hero.title');
    await page.keyboard.type('  mundo ');
    await page.getByRole('heading', { name: 'Servicios' }).click();

    expect(await title.evaluate((element) => element.innerHTML)).toBe(
      'Hola mundo',
    );
  });
});

test.describe('Enter and Escape (E4)', () => {
  test('Enter leaves the Field and keeps what was typed', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();

    const title = await editAtEnd(page, 'hero.title');
    await page.keyboard.type(' ya');
    await page.keyboard.press('Enter');

    await expect(title).not.toBeFocused();
    expect(await title.evaluate((element) => element.innerHTML)).toBe(
      `${built.title} ya`,
    );
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
    await expect(bar.getByRole('button', { name: 'Publicar' })).toBeEnabled();
  });

  test('Escape puts back the value the Field had when the caret entered', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    const count = bar.getByRole('status');
    const title = await editAtEnd(page, 'hero.title');
    await page.keyboard.type(' ya');
    await page.keyboard.press('Enter');

    await editAtEnd(page, 'hero.title');
    await page.keyboard.type(' mismo');
    await page.keyboard.press('Escape');

    await expect(title).not.toBeFocused();
    await expect(title).toHaveText(`${built.title} ya`);
    await expect(count).toHaveText('1 cambio');

    const lead = await editAll(page, 'hero.lead');
    await page.keyboard.type('Otra cosa');
    await expect(count).toHaveText('2 cambios');
    await page.keyboard.press('Escape');

    await expect(lead).toHaveText(built.lead);
    await expect(count).toHaveText('1 cambio');
  });

  test('typing the built value back leaves no Change', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    const count = bar.getByRole('status');

    await editAtEnd(page, 'hero.title');
    await page.keyboard.type('s');
    await expect(count).toHaveText('1 cambio');
    await page.keyboard.press('Backspace');

    await expect(count).toHaveText('Sin cambios');
    await expect(bar.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });
});

test.describe('numbers (E5)', () => {
  test('a number Field takes only digits and one comma or dot', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();

    const price = await editAll(page, 'visit.price');
    // Firefox types á through an IME composition, which cannot be refused
    // before it happens.
    await page.keyboard.type('4a0á,5.5 €');

    await expect(price).toHaveText('40,55');
    await page.keyboard.press('Enter');
    await expect(price).toHaveText('40,55');
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
    await expect(bar.getByRole('button', { name: 'Publicar' })).toBeEnabled();
  });

  test('it holds a number, read with a comma or a dot and shown as the template formats it', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    const count = bar.getByRole('status');

    const price = await editAll(page, 'visit.price');
    await page.keyboard.type('40.5');
    await page.keyboard.press('Enter');
    await expect(price).toHaveText('40,50');
    await expect(count).toHaveText('1 cambio');

    // 35 is the built value, however it is written.
    await editAll(page, 'visit.price');
    await page.keyboard.type('35');
    await page.keyboard.press('Enter');
    await expect(price).toHaveText('35,00');
    await expect(count).toHaveText('Sin cambios');
  });

  test('a number shown with thousands separators is edited without them', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    const patients = field(page, 'stats.patients');
    await expect(patients).toHaveText('12.000');

    await editAtEnd(page, 'stats.patients');
    await expect(patients).toHaveText('12000');
    await page.keyboard.type('5');
    await expect(patients).toHaveText('120005');
    await page.keyboard.press('Enter');

    await expect(patients).toHaveText('120.005');
  });

  test('a click between thousands puts the caret where it was clicked', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    const patients = field(page, 'stats.patients');
    // Between "12." and "000".
    const point = await patients.evaluate((element) => {
      const range = document.createRange();
      range.setStart(element.firstChild!, 3);
      range.setEnd(element.firstChild!, 4);
      const { left, top, height } = range.getBoundingClientRect();
      return { x: left + 1, y: top + height / 2 };
    });

    await page.mouse.click(point.x, point.y);
    await page.keyboard.type('9');

    await expect(patients).toHaveText('129000');
  });

  test('Publish stays disabled while a number Field holds no number', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    const publish = bar.getByRole('button', { name: 'Publicar' });
    const price = await editAll(page, 'visit.price');

    await page.keyboard.press('Backspace');
    await expect(price).toHaveText('');
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
    await expect(publish).toBeDisabled();

    // Leaving an empty Field, it can still be clicked into again.
    await page.keyboard.press('Enter');
    await price.click();
    await expect(price).toBeFocused();
    // Three decimals in a Field with two: in Spain, a thousand.
    await page.keyboard.type('1.000');
    await expect(publish).toBeDisabled();

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('10');
    await expect(publish).toBeEnabled();
  });
});

test.describe('links and buttons (E6)', () => {
  test('text in a link is edited without following the link', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    const url = page.url();
    await page.evaluate(() => {
      (window as Window & { stayed?: boolean }).stayed = true;
    });

    // The link is the Field.
    const cta = await editAtEnd(page, 'hero.cta');
    await page.keyboard.type(' ya');
    await page.keyboard.press('Enter');
    // The Field is inside a link to this same page.
    const footer = field(page, 'brand.name').last();
    await footer.click();
    await expect(footer).toBeFocused();
    await caretAtEnd(footer);
    await page.keyboard.type(' Madrid');
    await page.keyboard.press('Enter');

    await expect(cta).toHaveText(`${built.cta} ya`);
    await expect(footer).toHaveText(`${built.brand} Madrid`);
    expect(page.url()).toBe(url);
    expect(
      await page.evaluate(
        () => (window as Window & { stayed?: boolean }).stayed,
      ),
    ).toBe(true);
  });

  test('text in a button is edited without pressing the button', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    const url = page.url();
    await page.evaluate(() => {
      const form = document.querySelector('form')!;
      form.dataset.submits = '0';
      form.addEventListener('submit', () => {
        form.dataset.submits = String(Number(form.dataset.submits) + 1);
      });
    });

    // Chromium presses the button on a typed Space.
    const call = await editAtEnd(page, 'contact.call');
    await page.keyboard.type(' ahora mismo');
    await page.keyboard.press('Enter');

    await expect(call).toHaveText(`${built.call} ahora mismo`);
    await expect(page.locator('form')).toHaveAttribute('data-submits', '0');
    expect(page.url()).toBe(url);
  });
});

test('a value shown in two places changes in both while typing (E7)', async ({
  page,
  openEditor,
  bar,
}) => {
  await openEditor();
  const [header, footer] = await field(page, 'brand.name').all();

  await editAtEnd(page, 'brand.name');
  await page.keyboard.type(' Madrid');

  await expect(header!).toBeFocused();
  await expect(footer!).toHaveText(`${built.brand} Madrid`);
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
});

test.describe('Tab (E8)', () => {
  test('Tab moves to the next Field, inside links and buttons too, and Shift+Tab back', async ({
    page,
    openEditor,
  }) => {
    await openEditor();

    await field(page, 'hero.lead').click();
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedPath(page)).toBe('hero.cta');
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedPath(page)).toBe('stats.patients');

    await field(page, 'contact.title').click();
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedPath(page)).toBe('contact.call');
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedPath(page)).toBe('brand.name');
    await expect(field(page, 'brand.name').last()).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focusedPath(page)).toBe('contact.call');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => focusedPath(page)).toBe('contact.title');
  });

  test('Tab selects the next Field, so typing replaces its text', async ({
    page,
    openEditor,
  }) => {
    await openEditor();

    await field(page, 'visit.label').click();
    await page.keyboard.press('Tab');
    await page.keyboard.type('50');
    await page.keyboard.press('Enter');

    await expect(field(page, 'visit.price')).toHaveText('50,00');
  });
});

test('Discard puts every Field back as built (P1)', async ({
  page,
  openEditor,
  bar,
}) => {
  await openEditor();
  const title = await editAtEnd(page, 'hero.title');
  await page.keyboard.type(' ya');
  await page.keyboard.press('Enter');
  await editAll(page, 'visit.price');
  await page.keyboard.type('40');
  await page.keyboard.press('Enter');
  await editAtEnd(page, 'brand.name');
  await page.keyboard.type(' Madrid');
  await page.keyboard.press('Enter');
  await expect(bar.getByRole('status')).toHaveText('3 cambios');

  await bar.getByRole('button', { name: 'Descartar' }).click();

  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  await expect(title).toHaveText(built.title);
  await expect(field(page, 'visit.price')).toHaveText('35,00');
  await expect(field(page, 'brand.name')).toHaveText([
    built.brand,
    built.brand,
  ]);
});
