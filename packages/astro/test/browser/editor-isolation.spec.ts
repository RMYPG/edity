// N4: the Editor's controls live in a shadow root, isolated from the Site's
// CSS in both directions.
import type { Page } from '@playwright/test';
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

/** The computed `properties` of the Editor's host and of every element in its shadow root. */
function editorStyles(page: Page) {
  return page.locator('edity-root').evaluate((host, properties) => {
    const elements = [host, ...host.shadowRoot!.querySelectorAll('*')];
    return elements.map((element) => {
      const style = getComputedStyle(element);
      return [
        element.localName,
        ...properties.map((name) => style.getPropertyValue(name)),
      ];
    });
  }, properties);
}

/** The computed `properties` of every element of the Site's page. */
function siteStyles(page: Page) {
  return page.evaluate((properties) => {
    const elements = document.querySelectorAll('html, html *:not(edity-root)');
    return [...elements].map((element) => {
      const style = getComputedStyle(element);
      return [
        element.localName,
        ...properties.map((name) => style.getPropertyValue(name)),
      ];
    });
  }, properties);
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
  const before = await editorStyles(page);

  await page.addStyleTag({ content: hostileCss });

  expect(await editorStyles(page)).toEqual(before);
});

test("the Editor's CSS does not reach the Site", async ({
  page,
  openEditor,
}) => {
  await page.goto('/');
  const visitorsStyles = await siteStyles(page);

  await openEditor();

  expect(await siteStyles(page)).toEqual(visitorsStyles);
});
