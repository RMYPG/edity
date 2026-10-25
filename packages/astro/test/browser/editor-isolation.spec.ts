// N4: the Editor's controls live in a shadow root, isolated from the Site's
// CSS in both directions.
import type { JSHandle, Page } from '@playwright/test';
import { expect, test } from './editor.js';

/** The computed properties compared, on the Editor's elements and the Site's. */
const properties = [
  'display',
  'position',
  'visibility',
  'opacity',
  'filter',
  'transform',
  'z-index',
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration-line',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-radius',
  'box-shadow',
  'outline-style',
  'cursor',
];

/** The Editor's host and every element in its shadow root, as they are now. */
function editorElements(page: Page) {
  return page
    .locator('edity-root')
    .evaluateHandle((host) => [
      host,
      ...host.shadowRoot!.querySelectorAll('*'),
    ]);
}

/** The computed `properties` of `elements`. */
function editorStyles(elements: JSHandle<Element[]>) {
  return elements.evaluate(
    (elements, properties) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return [
          element.localName,
          ...properties.map((name) => style.getPropertyValue(name)),
        ];
      }),
    properties,
  );
}

/**
 * What the Editor styles on purpose on the Site's elements while editing,
 * by selector: the marks that show Fields are editable (E1), and the cursor
 * that shows Items can be dragged (S2), which their contents inherit.
 */
const marks = {
  '[data-edity-field]': ['outline-style', 'cursor'],
  '[data-edity-item], [data-edity-item] *': ['cursor'],
};

/**
 * The computed `properties` of every element of the Site's page, but for
 * the `except` ones on the elements their selectors match.
 */
function siteStyles(
  page: Page,
  except: Readonly<Record<string, readonly string[]>> = {},
) {
  return page.evaluate(
    ({ properties, except }) => {
      const elements = document.querySelectorAll(
        'html, html *:not(edity-root)',
      );
      return [...elements].map((element) => {
        const style = getComputedStyle(element);
        const skipped = Object.entries(except).flatMap(([selector, names]) =>
          element.matches(selector) ? names : [],
        );
        return [
          element.localName,
          ...properties.map((name) =>
            skipped.includes(name) ? '' : style.getPropertyValue(name),
          ),
        ];
      });
    },
    { properties, except },
  );
}

/**
 * CSS a Site could have: global rules, `!important`, a root font size,
 * inherited properties, custom properties named like the Editor's, and rules
 * that select the Editor's host without naming it.
 */
const hostileCss = `
  html { font-size: 10px; color: green; cursor: wait; }
  :root { --edity-surface: red; --edity-text: red; }
  * {
    color: red !important;
    font: italic 700 30px/3 serif !important;
    letter-spacing: 2px !important;
    text-transform: uppercase !important;
    text-decoration: underline !important;
    --edity-accent: red !important;
  }
  :root > :last-child, body ~ * {
    display: none !important;
    opacity: 0.5 !important;
    filter: blur(2px) !important;
    transform: scale(0.5) !important;
    padding: 40px !important;
    border: 5px solid lime !important;
    position: absolute !important;
  }
  div, span, button, svg {
    background: yellow !important;
    padding: 30px !important;
    margin: 10px !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    outline: 3px solid blue !important;
  }
`;

test("the Site's CSS does not reach the Editor", async ({
  page,
  openEditor,
}) => {
  await openEditor();
  // A Limit counter shows too (L3).
  await page.locator('[data-edity-field="contact.call"]').click();
  await page.keyboard.type(' ya mismo, por favor');
  await expect(page.locator('edity-root .counter')).toHaveCount(1);
  // The same elements after, though the Site's CSS can make more counters
  // show, for Fields it gives more lines.
  const elements = await editorElements(page);
  const before = await editorStyles(elements);

  await page.addStyleTag({ content: hostileCss });

  expect(await editorStyles(elements)).toEqual(before);
});

test("the Editor's CSS does not reach the Site, but for the marks on its Fields and Items", async ({
  page,
  openEditor,
}) => {
  await page.goto('/');
  const visitorsStyles = await siteStyles(page, marks);

  await openEditor();

  expect(await siteStyles(page, marks)).toEqual(visitorsStyles);
});

test('in the visitor view, the Site looks exactly as a visitor sees it (P7)', async ({
  page,
  openEditor,
  bar,
}) => {
  await page.goto('/');
  const visitorsStyles = await siteStyles(page);
  await openEditor();

  await bar.getByRole('button', { name: 'Vista de visitante' }).click();
  await expect(bar).toHaveCount(0);

  expect(await siteStyles(page)).toEqual(visitorsStyles);
});
