// S1 to S7: the Client adds, removes and reorders the Items of the page's
// Lists, and an edit to a List's structure makes the whole List one Change.
import {
  devices,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { ana, expect, test } from './editor.js';

/** The fixture page's Lists as built, as `src/content/home.json` holds them. */
const built = {
  services: [
    'Fisioterapia deportiva',
    'Suelo pélvico',
    'Punción seca',
    'Rehabilitación tras cirugía 🦴',
  ],
  plans: ['Básico', 'Completo'],
  basico: ['Una sesión al mes', 'Seguimiento por correo'],
  completo: [
    'Cuatro sesiones al mes',
    'Plan de ejercicios en casa',
    'Seguimiento por WhatsApp',
  ],
} as const;

/** The Site's elements that show the Field at `path`. */
function field(page: Page, path: string): Locator {
  return page.locator(`[data-edity-field="${path}"]`);
}

/** The Site's Item element at `path`. */
function item(page: Page, path: string): Locator {
  return page.locator(`[data-edity-item="${path}"]`);
}

/** The text of the first Field of each Item of the List at `path`. */
function texts(page: Page, path: string): Promise<string[]> {
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

/** The List element at `path`. */
function list(page: Page, path: string): Locator {
  return page.locator(`[data-edity-list="${path}"]`);
}

/**
 * Every path in the List at `path`, Items' and Fields', inside templates
 * too, in document order.
 */
function paths(page: Page, path: string): Promise<string[]> {
  return pathsIn(list(page, path));
}

/** Every path in `locator`'s element and inside it, templates included. */
function pathsIn(locator: Locator): Promise<string[]> {
  return locator.evaluate((list) => {
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
        if (element instanceof HTMLTemplateElement) walk(element.content);
      }
    };
    for (const name of ['data-edity-item', 'data-edity-field']) {
      const value = list.getAttribute(name);
      if (value !== null && list.hasAttribute('data-edity-item')) {
        found.push(`${name.slice(11)}=${value}`);
      }
    }
    walk(list);
    return found;
  });
}

/**
 * The paths in the Items of the List at `path`, templates included, that
 * are not their own Item's or under it: none, once Items are renumbered.
 */
function strayPaths(page: Page, path: string): Promise<string[]> {
  return list(page, path).evaluate((list) => {
    const stray: string[] = [];
    const check = (root: ParentNode, prefix: string) => {
      for (const element of root.querySelectorAll('*')) {
        for (const name of [
          'data-edity-item',
          'data-edity-field',
          'data-edity-list',
          'data-edity-template',
        ]) {
          const value = element.getAttribute(name);
          if (value !== null && !value.startsWith(prefix)) stray.push(value);
        }
        if (element instanceof HTMLTemplateElement) {
          check(element.content, prefix);
        }
      }
    };
    for (const item of list.querySelectorAll(':scope > [data-edity-item]')) {
      check(item, `${item.getAttribute('data-edity-item')}`);
    }
    return stray;
  });
}

/**
 * Clicks into the Field at `path`, so its Item's controls show. It clicks
 * near the text's start: the controls of the Item below, which sit above
 * that Item's end, can cover this one's on a phone.
 */
async function focusField(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  const box = (await locator.boundingBox())!;
  await locator.click({ position: { x: 4, y: box.height / 2 } });
  await expect(locator).toBeFocused();
  return locator;
}

/** Puts the caret at the end of the focused Field's text. */
async function caretAtEnd(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Scrolls `locator` to the middle of the window. The mouse does not scroll
 * the page on its own, and at the window's bottom edge the Editor's bar
 * covers the page.
 */
async function centre(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    element.scrollIntoView({ block: 'center' }),
  );
}

/**
 * A point in `locator`'s box, `x` and `y` as fractions of its size, in
 * whole pixels: from a fractional point, Chromium sometimes starts no text
 * selection.
 */
async function at(locator: Locator, x: number, y: number): Promise<Point> {
  const box = (await locator.boundingBox())!;
  return {
    x: Math.round(box.x + box.width * x),
    y: Math.round(box.y + box.height * y),
  };
}

/** Drags with the mouse from one point to another, as a person does. */
async function mouseDrag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** A point beside the text of a services Item, still inside its row. */
async function besideText(page: Page, path: string): Promise<Point> {
  const row = item(page, path);
  const box = (await row.boundingBox())!;
  const end = await row.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().right;
  });
  return {
    x: Math.round(Math.min(end + 20, box.x + box.width - 4)),
    y: Math.round(box.y + box.height / 2),
  };
}

test.describe('bounds (S1)', () => {
  test('at its maximum, a List takes no more Items, and says why', async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor();
    await focusField(page, 'services.0');
    const add = editor.getByRole('button', {
      name: 'Añadir elemento',
      exact: true,
    });

    for (let count = 5; count <= 8; count++) {
      await add.click();
      await expect(item(page, `services.${count - 1}`)).toBeFocused();
      await page.keyboard.type(`Servicio ${count}`);
    }

    await expect(add).toBeDisabled();
    await expect(editor.getByText('Máximo 8 elementos')).toBeVisible();
    await expect(add).toHaveAccessibleDescription('Máximo 8 elementos');
    // Enter only leaves the Field.
    await page.keyboard.press('Enter');
    await expect(item(page, 'services.7')).not.toBeFocused();
    expect(await texts(page, 'services')).toEqual([
      ...built.services,
      'Servicio 5',
      'Servicio 6',
      'Servicio 7',
      'Servicio 8',
    ]);
  });

  test('at its minimum, no Item can be removed, and the List says why', async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor();
    await focusField(page, 'plans.0.features.1');
    await editor
      .getByRole('button', { name: 'Quitar «Seguimiento por correo»' })
      .click();
    await expect
      .poll(() => texts(page, 'plans.0.features'))
      .toEqual([built.basico[0]]);

    const last = await focusField(page, 'plans.0.features.0');
    const remove = editor.getByRole('button', {
      name: 'Quitar «Una sesión al mes»',
    });
    await expect(remove).toBeDisabled();
    await expect(editor.getByText('Mínimo 1 elemento')).toBeVisible();
    // Nor does Backspace in its empty text.
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(last).toHaveText('');
    await expect.poll(() => texts(page, 'plans.0.features')).toEqual(['']);
  });
});

test('a List that may be empty keeps a way to add an Item once it is (S1)', async ({
  page,
  signIn,
  editor,
  bar,
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
  await signIn();
  await page.goto('/');
  await expect(bar).toBeVisible();

  for (const service of built.services) {
    await focusField(page, 'services.0');
    await editor.getByRole('button', { name: `Quitar «${service}»` }).click();
  }
  await expect.poll(() => texts(page, 'services')).toEqual([]);
  // Away from the List, its add button stays.
  await page.getByRole('heading', { name: 'Bonos' }).click();
  const add = editor.getByRole('button', {
    name: 'Añadir elemento',
    exact: true,
  });
  await expect(add).toBeVisible();
  await expect(editor.getByText(/Mínimo/)).toHaveCount(0);

  await add.click();
  await expect(item(page, 'services.0')).toBeFocused();
  await page.keyboard.type('Masaje');
  expect(await texts(page, 'services')).toEqual(['Masaje']);
});

test.describe('reordering (S2)', () => {
  test('a mouse drags an Item from beside its text', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    await centre(list(page, 'services'));

    await mouseDrag(
      page,
      await besideText(page, 'services.0'),
      await at(item(page, 'services.2'), 0.5, 0.8),
    );

    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        built.services[1],
        built.services[2],
        built.services[0],
        built.services[3],
      ]);
    expect(await paths(page, 'services')).toEqual([
      'item=services.0',
      'field=services.0',
      'item=services.1',
      'field=services.1',
      'item=services.2',
      'field=services.2',
      'item=services.3',
      'field=services.3',
      'template=services',
      'item=services.4',
      'field=services.4',
    ]);
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
    expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
  });

  test('a mouse drags an Item from anything in it that is not a Field, and cards go across', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();

    // The tick before a feature's text.
    await centre(list(page, 'plans.1.features'));
    await mouseDrag(
      page,
      await at(item(page, 'plans.1.features.0').locator('.tick'), 0.5, 0.5),
      await at(item(page, 'plans.1.features.2'), 0.5, 0.9),
    );
    await expect
      .poll(() => texts(page, 'plans.1.features'))
      .toEqual([built.completo[1], built.completo[2], built.completo[0]]);

    // A card's padding, to past the middle of the next card: beside it on
    // a wide screen, below it on a phone.
    await centre(item(page, 'plans.1'));
    await mouseDrag(
      page,
      await at(item(page, 'plans.0'), 0.03, 0.97),
      await at(item(page, 'plans.1'), 0.9, 0.6),
    );
    await expect
      .poll(() => texts(page, 'plans'))
      .toEqual([built.plans[1], built.plans[0]]);
    // The card moved with its own List, renumbered, its template too.
    expect(await texts(page, 'plans.0.features')).toEqual([
      built.completo[1],
      built.completo[2],
      built.completo[0],
    ]);
    expect(await strayPaths(page, 'plans')).toEqual([]);
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
  });

  test('a mouse pressed on text selects it and moves nothing', async ({
    page,
    openEditor,
    bar,
    isMobile,
  }) => {
    await openEditor();
    const name = field(page, 'plans.0.name');
    await centre(item(page, 'plans.1'));
    const from = await at(name, 0.05, 0.5);
    const beyond = await at(name, 0.9, 0.5);
    const next = await at(item(page, 'plans.1'), 0.9, 0.6);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(beyond.x, beyond.y, { steps: 4 });
    // A phone selects text with a long press instead.
    if (!isMobile) {
      const selected = await page.evaluate(() => getSelection()!.toString());
      expect(selected).not.toBe('');
      expect(built.plans[0].endsWith(selected)).toBe(true);
    }
    // On, past the middle of the next card.
    await page.mouse.move(next.x, next.y, { steps: 8 });
    await page.mouse.up();

    expect(await texts(page, 'plans')).toEqual(built.plans);
    await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  });

  test('a click beside an Item’s text still puts the caret in it', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    await centre(item(page, 'services.1'));
    const point = await besideText(page, 'services.1');

    await page.mouse.click(point.x, point.y);
    await expect(item(page, 'services.1')).toBeFocused();
    await page.keyboard.type(' y más');

    await expect(item(page, 'services.1')).toHaveText(
      `${built.services[1]} y más`,
    );
  });

  test('Escape puts a dragged Item back where it was', async ({
    page,
    openEditor,
    bar,
  }) => {
    await openEditor();
    await centre(list(page, 'services'));
    const to = await at(item(page, 'services.3'), 0.5, 0.8);
    const from = await besideText(page, 'services.0');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await expect
      .poll(() => texts(page, 'services'))
      .not.toEqual(built.services);

    await page.keyboard.press('Escape');
    await page.mouse.up();

    expect(await texts(page, 'services')).toEqual(built.services);
    await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  });

  test('arrow buttons move an Item, keep the focus and say where it went', async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor();
    await focusField(page, 'services.1');
    const up = editor.getByRole('button', { name: 'Subir «Suelo pélvico»' });
    const down = editor.getByRole('button', { name: 'Bajar «Suelo pélvico»' });

    await down.click();
    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        built.services[0],
        built.services[2],
        built.services[1],
        built.services[3],
      ]);
    await expect(editor.locator('[aria-live]')).toHaveText(
      '«Suelo pélvico», posición 3 de 4',
    );

    await up.focus();
    await page.keyboard.press('Enter');
    await expect(up).toBeFocused();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        built.services[1],
        built.services[0],
        built.services[2],
        built.services[3],
      ]);
    // First now: Subir cannot go on, so the focus goes to the handle.
    await expect(up).toBeDisabled();
    const handle = editor.getByRole('button', {
      name: 'Arrastrar «Suelo pélvico»',
    });
    await expect(handle).toBeFocused();

    // The handle moves the Item with the arrow keys.
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => texts(page, 'services')).toEqual(built.services);
    await expect(handle).toBeFocused();
  });
});

test.describe('reordering by touch (S2)', () => {
  test('the handle is ready for a finger from the start', async ({
    page,
    openEditor,
    editor,
    browserName,
  }) => {
    await openEditor();
    await focusField(page, 'services.1');
    const handle = editor.getByRole('button', {
      name: 'Arrastrar «Suelo pélvico»',
    });

    // The browser reads touch-action when the finger lands, so it is set in
    // CSS beforehand; a long press neither selects nor opens a menu.
    await expect(handle).toHaveCSS('touch-action', 'none');
    await expect(handle).toHaveCSS('user-select', 'none');
    if (browserName === 'webkit') {
      await expect(handle).toHaveCSS('-webkit-user-select', 'none');
    }
    // Only iOS builds of WebKit know -webkit-touch-callout.
    if (
      await page.evaluate(() => CSS.supports('-webkit-touch-callout', 'none'))
    ) {
      await expect(handle).toHaveCSS('-webkit-touch-callout', 'none');
    }
  });

  test('in Chromium, a real touch drag on the handle reorders the Items', async ({
    browser,
    browserName,
    baseURL,
  }) => {
    test.skip(browserName !== 'chromium', 'touch input needs Chromium’s CDP');
    const { context, page } = await touchPage(browser, baseURL!);
    const editor = page.locator('edity-root');
    await centre(list(page, 'services'));
    await field(page, 'services.0').tap();
    const handle = editor.getByRole('button', {
      name: 'Arrastrar «Fisioterapia deportiva»',
    });
    await expect(handle).toBeVisible();
    const from = await at(handle, 0.5, 0.5);
    const to = await at(item(page, 'services.2'), 0.5, 0.8);
    const scrolled = await page.evaluate(() => scrollY);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [from],
    });
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * step) / 12,
            y: from.y + ((to.y - from.y) * step) / 12,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        built.services[1],
        built.services[2],
        built.services[0],
        built.services[3],
      ]);
    // The finger dragged the Item, not the page.
    expect(await page.evaluate(() => scrollY)).toBe(scrolled);
    await expect(
      page.locator('edity-root').getByRole('region').getByRole('status'),
    ).toHaveText('1 cambio');
    await context.close();
  });

  test('on an iPhone, a touch drag on the handle reorders the Items', async ({
    page,
    openEditor,
    editor,
    bar,
    hasTouch,
  }) => {
    test.skip(!hasTouch, 'a touch screen');
    await openEditor();
    await centre(list(page, 'services'));
    await field(page, 'services.0').tap();
    const handle = editor.getByRole('button', {
      name: 'Arrastrar «Fisioterapia deportiva»',
    });
    await expect(handle).toBeVisible();
    const from = await at(handle, 0.5, 0.5);
    const to = await at(item(page, 'services.2'), 0.5, 0.8);

    // Playwright can only tap in WebKit, so these are synthetic pointer
    // events, which WebKit cannot capture: they test the code, not the
    // browser's gesture handling. Real iOS Safari is checked by hand.
    await handle.evaluate(
      (element, { from, to }) => {
        const send = (type: string, x: number, y: number) =>
          element.dispatchEvent(
            new PointerEvent(type, {
              pointerType: 'touch',
              pointerId: 7,
              isPrimary: true,
              bubbles: true,
              composed: true,
              cancelable: true,
              clientX: x,
              clientY: y,
            }),
          );
        send('pointerdown', from.x, from.y);
        for (let step = 1; step <= 12; step++) {
          send(
            'pointermove',
            from.x + ((to.x - from.x) * step) / 12,
            from.y + ((to.y - from.y) * step) / 12,
          );
        }
        send('pointerup', to.x, to.y);
      },
      { from, to },
    );

    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        built.services[1],
        built.services[2],
        built.services[0],
        built.services[3],
      ]);
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
  });

  test('a touch on an Item outside its handle does not drag it', async ({
    page,
    openEditor,
    hasTouch,
  }) => {
    test.skip(!hasTouch, 'a touch screen');
    await openEditor();
    const tick = item(page, 'plans.0.features.0').locator('.tick');
    await centre(tick);

    await tick.tap();
    await tick.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const send = (type: string, y: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerType: 'touch',
            pointerId: 8,
            isPrimary: true,
            bubbles: true,
            composed: true,
            cancelable: true,
            clientX: box.x + 2,
            clientY: y,
          }),
        );
      send('pointerdown', box.y + 2);
      send('pointermove', box.y + 80);
      send('pointerup', box.y + 80);
    });

    expect(await texts(page, 'plans.0.features')).toEqual(built.basico);
  });
});

/** A signed-in page in Chromium with a touch screen, for CDP touch input. */
async function touchPage(
  browser: Browser,
  baseURL: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL });
  await context.addCookies([{ name: 'edity', value: '1', url: baseURL }]);
  const page = await context.newPage();
  await page.route('**/_edity/api/session', (route) =>
    route.fulfill({ json: ana }),
  );
  await page.goto('/');
  await expect(page.locator('edity-root').getByRole('region')).toBeVisible();
  return { context, page };
}

/**
 * What an element is made of, without its text or the indices in its
 * paths, and with each List cut to its first Item.
 */
function shapeOf(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const copy = element.cloneNode(true) as Element;
    for (const list of copy.querySelectorAll('[data-edity-list]')) {
      const items = [...list.children].filter((child) =>
        child.hasAttribute('data-edity-item'),
      );
      for (const extra of items.slice(1)) extra.remove();
    }
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      texts.push(node as Text);
    }
    for (const text of texts) text.remove();
    return copy.outerHTML.replace(/\.\d+(?=[."])/g, '.N');
  });
}

test.describe('new Items (S3)', () => {
  test('a new Item has the markup the build gave its template, and is edited like the rest', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    await focusField(page, 'plans.1.name');
    const publish = bar.getByRole('button', { name: 'Publicar' });

    await editor
      .getByRole('button', { name: 'Añadir elemento', exact: true })
      .click();

    const card = item(page, 'plans.2');
    await expect(field(page, 'plans.2.name')).toBeFocused();
    expect(await shapeOf(card)).toBe(await shapeOf(item(page, 'plans.0')));
    expect(await pathsIn(card)).toEqual([
      'item=plans.2',
      'field=plans.2.name',
      'field=plans.2.price',
      'list=plans.2.features',
      'item=plans.2.features.0',
      'field=plans.2.features.0',
      'template=plans.2.features',
      'item=plans.2.features.1',
      'field=plans.2.features.1',
    ]);
    // Blank, the price too, which the template shows as 0,00.
    await expect(field(page, 'plans.2.price')).toHaveText('');
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
    await expect(publish).toBeDisabled();

    await page.keyboard.type('Familiar');
    await page.keyboard.press('Tab');
    await page.keyboard.type('79,9');
    await page.keyboard.press('Tab');
    await expect(field(page, 'plans.2.price')).toHaveText('79,90');
    await page.keyboard.type('Para toda la familia');
    await expect(publish).toBeEnabled();

    // Its own List takes new Items from its own template.
    await editor
      .getByRole('button', { name: 'Añadir elemento a «Familiar»' })
      .click();
    await expect(field(page, 'plans.2.features.1')).toBeFocused();
    await expect(publish).toBeDisabled();
    await page.keyboard.type('Sin permanencia');
    await expect(publish).toBeEnabled();
    expect(await texts(page, 'plans.2.features')).toEqual([
      'Para toda la familia',
      'Sin permanencia',
    ]);
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
  });
});

test.describe('Enter and Backspace in simple Lists (S4)', () => {
  test('Enter adds an Item below with the text after the caret, and the caret goes there', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    const suelo = await focusField(page, 'services.1');
    await caretAtEnd(suelo);

    await page.keyboard.press('Enter');
    await expect(item(page, 'services.2')).toBeFocused();
    await page.keyboard.type('Masaje');
    expect(await texts(page, 'services')).toEqual([
      built.services[0],
      built.services[1],
      'Masaje',
      ...built.services.slice(2),
    ]);

    // In the middle of a text, Enter splits it in two.
    await focusField(page, 'services.0');
    await item(page, 'services.0').evaluate((element) => {
      const range = document.createRange();
      range.setStart(element.firstChild!, 'Fisioterapia '.length);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
    });
    await page.keyboard.press('Enter');
    await expect(item(page, 'services.1')).toBeFocused();
    await page.keyboard.type('y ');
    expect((await texts(page, 'services')).slice(0, 2)).toEqual([
      'Fisioterapia',
      'y deportiva',
    ]);
  });

  test('Backspace in an empty Item removes it, and the caret goes to the end of the one before', async ({
    page,
    openEditor,
    editor,
  }) => {
    await openEditor();
    await focusField(page, 'services.1');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(item(page, 'services.1')).toHaveText('');

    await page.keyboard.press('Backspace');
    await expect(item(page, 'services.0')).toBeFocused();
    await page.keyboard.type('!');

    expect(await texts(page, 'services')).toEqual([
      `${built.services[0]}!`,
      ...built.services.slice(2),
    ]);
    // Nothing was lost, so there is nothing to undo.
    await expect(editor.getByRole('button', { name: 'Deshacer' })).toHaveCount(
      0,
    );
  });

  test('a List inside an Item takes Enter and Backspace too', async ({
    page,
    openEditor,
  }) => {
    await openEditor();
    const first = await focusField(page, 'plans.0.features.0');
    await caretAtEnd(first);

    await page.keyboard.press('Enter');
    await expect(field(page, 'plans.0.features.1')).toBeFocused();
    await page.keyboard.type('Dos');
    expect(await texts(page, 'plans.0.features')).toEqual([
      built.basico[0],
      'Dos',
      built.basico[1],
    ]);

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(first).toBeFocused();
    expect(await texts(page, 'plans.0.features')).toEqual(built.basico);
  });
});

test.describe('one level of nesting (S5)', () => {
  test("a List inside an Item is edited on its own, and is a Change of its own while the outer List's structure is unchanged", async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    const count = bar.getByRole('status');

    await focusField(page, 'plans.1.features.2');
    await editor
      .getByRole('button', { name: 'Subir «Seguimiento por WhatsApp»' })
      .click();
    await editor
      .getByRole('button', { name: 'Añadir elemento a «Completo»' })
      .click();
    await page.keyboard.type('Sin permanencia');
    await expect
      .poll(() => texts(page, 'plans.1.features'))
      .toEqual([
        built.completo[0],
        built.completo[2],
        built.completo[1],
        'Sin permanencia',
      ]);
    await expect(count).toHaveText('1 cambio');

    // The other card's List is another Change.
    await focusField(page, 'plans.0.features.1');
    await editor
      .getByRole('button', { name: 'Quitar «Seguimiento por correo»' })
      .click();
    await expect(count).toHaveText('2 cambios');
    // And so is a Field of a card.
    const name = await focusField(page, 'plans.0.name');
    await caretAtEnd(name);
    await page.keyboard.type('+');
    await expect(count).toHaveText('3 cambios');

    // Once the cards move, the List of cards is the one Change.
    await editor.getByRole('button', { name: 'Bajar «Básico+»' }).click();
    await expect
      .poll(() => texts(page, 'plans'))
      .toEqual([built.plans[1], 'Básico+']);
    await expect(count).toHaveText('1 cambio');
    expect(await texts(page, 'plans.1.features')).toEqual([built.basico[0]]);
  });
});

test.describe('Undo (S6)', () => {
  test('removing an Item offers Undo, which puts it back where it was', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    await caretAtEnd(await focusField(page, 'services.1'));
    await page.keyboard.type('!');

    await editor
      .getByRole('button', { name: 'Quitar «Suelo pélvico!»' })
      .click();
    expect(await texts(page, 'services')).toEqual([
      built.services[0],
      ...built.services.slice(2),
    ]);
    const undo = editor.getByRole('button', { name: 'Deshacer' });
    await expect(
      editor.getByRole('status').filter({ hasText: 'quitado' }),
    ).toHaveText('«Suelo pélvico!» quitado' + 'Deshacer');

    await undo.click();

    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        built.services[0],
        `${built.services[1]}!`,
        ...built.services.slice(2),
      ]);
    await expect(editor.getByRole('button', { name: 'Deshacer' })).toHaveCount(
      0,
    );
    // The List is as built again, so only the edited Field is a Change.
    await expect(bar.getByRole('status')).toHaveText('1 cambio');
  });

  test('Undo goes after a few seconds, but not while the pointer is on it', async ({
    page,
    openEditor,
    editor,
  }) => {
    await page.clock.install();
    await openEditor();
    await focusField(page, 'services.1');
    await editor
      .getByRole('button', { name: 'Quitar «Suelo pélvico»' })
      .click();
    const undo = editor.getByRole('button', { name: 'Deshacer' });
    await expect(undo).toBeVisible();

    await undo.hover();
    await page.clock.runFor(10_000);
    await expect(undo).toBeVisible();

    await page.mouse.move(0, 0);
    await page.clock.runFor(5_000);
    await expect(undo).toBeVisible();
    await page.clock.runFor(2_000);
    await expect(undo).toHaveCount(0);
  });
});

test.describe('one Change per List (S7)', () => {
  test('a structural edit makes the whole List one Change, and Fields edited in it add none', async ({
    page,
    openEditor,
    editor,
    bar,
  }) => {
    await openEditor();
    const count = bar.getByRole('status');
    for (const path of ['services.0', 'services.2']) {
      await caretAtEnd(await focusField(page, path));
      await page.keyboard.type('!');
    }
    await expect(count).toHaveText('2 cambios');

    await focusField(page, 'services.3');
    await editor
      .getByRole('button', { name: `Subir «${built.services[3]}»` })
      .click();
    await expect(count).toHaveText('1 cambio');
    await caretAtEnd(await focusField(page, 'services.1'));
    await page.keyboard.type('!');
    await expect(count).toHaveText('1 cambio');

    // Back as built, each edited Field is a Change again.
    await focusField(page, 'services.2');
    await editor
      .getByRole('button', { name: `Bajar «${built.services[3]}»` })
      .click();
    await expect
      .poll(() => texts(page, 'services'))
      .toEqual([
        `${built.services[0]}!`,
        `${built.services[1]}!`,
        `${built.services[2]}!`,
        built.services[3],
      ]);
    await expect(count).toHaveText('3 cambios');
  });
});

test('Discard puts every List back as built (P1)', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await openEditor();
  const before = {
    services: await paths(page, 'services'),
    plans: await paths(page, 'plans'),
  };
  await caretAtEnd(await focusField(page, 'services.3'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('Masaje');
  await focusField(page, 'plans.0.features.1');
  await editor
    .getByRole('button', { name: 'Quitar «Seguimiento por correo»' })
    .click();
  await caretAtEnd(await focusField(page, 'plans.1.name'));
  await page.keyboard.type(' Plus');
  await editor.getByRole('button', { name: 'Subir «Completo Plus»' }).click();
  await expect(bar.getByRole('status')).toHaveText('2 cambios');

  await bar.getByRole('button', { name: 'Descartar' }).click();

  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  expect(await texts(page, 'services')).toEqual(built.services);
  expect(await texts(page, 'plans')).toEqual(built.plans);
  expect(await texts(page, 'plans.0.features')).toEqual(built.basico);
  expect(await texts(page, 'plans.1.features')).toEqual(built.completo);
  expect(await paths(page, 'services')).toEqual(before.services);
  expect(await paths(page, 'plans')).toEqual(before.plans);
  await expect(field(page, 'plans.0.price')).toHaveText('19,99');
  await expect(editor.getByRole('button', { name: 'Deshacer' })).toHaveCount(0);
});

test('the visitor view hides the List controls, and Items no longer move (P7)', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await openEditor();
  await focusField(page, 'services.1');
  await expect(
    editor.getByRole('button', { name: 'Quitar «Suelo pélvico»' }),
  ).toBeVisible();

  await bar.getByRole('button', { name: 'Vista de visitante' }).click();

  await expect(editor.getByRole('button')).toHaveText(['Volver a editar']);
  await centre(list(page, 'services'));
  await mouseDrag(
    page,
    await besideText(page, 'services.0'),
    await at(item(page, 'services.2'), 0.5, 0.8),
  );
  await expect(editor.getByRole('button')).toHaveText(['Volver a editar']);
  expect(await texts(page, 'services')).toEqual(built.services);
});

test.describe('the List controls speak the Client’s language (N6)', () => {
  /** Every text and label of the List controls, in document order. */
  function controlsText(editor: Locator): Promise<string[]> {
    return editor.evaluate((host) => {
      const texts: string[] = [];
      const root = host.shadowRoot!.querySelector('.lists')!;
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node instanceof Text) {
          if (node.data.trim() !== '') texts.push(node.data.trim());
          continue;
        }
        for (const name of ['aria-label', 'title']) {
          const value = (node as Element).getAttribute(name);
          if (value) texts.push(value);
        }
      }
      return texts;
    });
  }

  const languages = [
    {
      locale: 'es',
      controls: [
        'Añadir elemento a «Básico»',
        'Añadir',
        'Mínimo 1 elemento',
        'Arrastrar «Una sesión al mes»',
        'Arrastrar «Una sesión al mes»',
        'Subir «Una sesión al mes»',
        'Subir «Una sesión al mes»',
        'Bajar «Una sesión al mes»',
        'Bajar «Una sesión al mes»',
        'Quitar «Una sesión al mes»',
        'Quitar «Una sesión al mes»',
      ],
      remove: 'Quitar «Seguimiento por correo»',
      removed: ['«Seguimiento por correo» quitado', 'Deshacer'],
    },
    {
      locale: 'en',
      controls: [
        'Add item to “Básico”',
        'Add',
        'At least 1 item',
        'Drag “Una sesión al mes”',
        'Drag “Una sesión al mes”',
        'Move “Una sesión al mes” up',
        'Move “Una sesión al mes” up',
        'Move “Una sesión al mes” down',
        'Move “Una sesión al mes” down',
        'Remove “Una sesión al mes”',
        'Remove “Una sesión al mes”',
      ],
      remove: 'Remove “Seguimiento por correo”',
      removed: ['“Seguimiento por correo” removed', 'Undo'],
    },
  ];

  for (const { locale, controls, remove, removed } of languages) {
    test(`in "${locale}"`, async ({ page, openEditor, editor }) => {
      await openEditor({ session: { ...ana, locale } });
      await focusField(page, 'plans.0.features.1');

      await editor.getByRole('button', { name: remove }).click();
      await focusField(page, 'plans.0.features.0');

      const texts = await controlsText(editor);
      // The List of cards comes first, with its add button.
      expect(texts.slice(0, 2)).toEqual([
        locale === 'es' ? 'Añadir elemento' : 'Add item',
        locale === 'es' ? 'Añadir' : 'Add',
      ]);
      expect(texts.slice(2, -removed.length)).toEqual(controls);
      expect(texts.slice(-removed.length)).toEqual(removed);
    });
  }
});
