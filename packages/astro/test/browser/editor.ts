// Fixtures for browser tests of the Editor. Import `test` and `expect` from
// here instead of from @playwright/test.
import {
  test as base,
  expect,
  type FrameLocator,
  type Locator,
  type Page,
} from '@playwright/test';

export { expect };

/** What `GET /_edity/api/session` returns for a signed-in Client. */
export interface Session {
  readonly name: string;
  readonly locale: string;
  readonly site: string;
}

/** A Client who reads Spanish. */
export const ana: Session = { name: 'Ana', locale: 'es', site: 'fixture' };

export interface SignInOptions {
  /** The session the server returns. Defaults to `ana`. */
  readonly session?: Session;
  /** The status the server answers the session call with. Defaults to 200. */
  readonly status?: number;
}

interface EditorFixtures {
  /**
   * The Editor's host element. Scope Editor locators with it: locators
   * pierce shadow roots, so unscoped ones can match the Site's markup too.
   */
  editor: Locator;
  /** The Editor's bar, on the page as signed-in Clients see it. */
  bar: Locator;
  /**
   * Makes the browser look signed in from the next page load on: it carries
   * the `edity=1` marker cookie, and the session call, which `astro preview`
   * does not serve, answers as the server would.
   */
  signIn(options?: SignInOptions): Promise<void>;
  /** Signs in, opens the fixture page and waits for the bar. */
  openEditor(options?: SignInOptions): Promise<void>;
}

export const test = base.extend<EditorFixtures>({
  editor: async ({ page }, use) => {
    await use(page.locator('edity-root'));
  },
  bar: async ({ editor }, use) => {
    // The bar's name is in the Client's language.
    await use(editor.getByRole('region'));
  },
  signIn: async ({ context, page, baseURL }, use) => {
    await use(async ({ session = ana, status = 200 } = {}) => {
      await context.addCookies([{ name: 'edity', value: '1', url: baseURL! }]);
      await page.route('**/_edity/api/session', (route) =>
        status === 200
          ? route.fulfill({ json: session })
          : route.fulfill({ status }),
      );
    });
  },
  openEditor: async ({ page, signIn, bar }, use) => {
    await use(async (options) => {
      await signIn(options);
      await page.goto('/');
      await expect(bar).toBeVisible();
    });
  },
});

/** Records the path of every request the page makes from now on. */
export function recordRequests(page: Page): string[] {
  const paths: string[] = [];
  page.on('request', (request) => paths.push(new URL(request.url()).pathname));
  return paths;
}

/** A Change, as the Editor keeps it in the browser and Publish sends it. */
export interface KeptChange {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

/** Where the Editor keeps the fixture page's Draft, for `ana`'s Site (P2). */
const draftKey = 'edity:draft:v1:fixture:home';

/**
 * Keeps `changes` in the browser as the fixture page's Draft, as an earlier
 * visit would have. Call it before `signIn`: it opens the page as a visitor
 * sees it, so no Editor keeps its own Draft over it.
 */
export async function keepDraft(
  page: Page,
  changes: readonly KeptChange[],
): Promise<void> {
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    draftKey,
    JSON.stringify({ changes }),
  ] as const);
}

/** The Changes of the Draft the browser keeps for the fixture page, if any. */
export function keptDraft(page: Page): Promise<KeptChange[] | undefined> {
  return page.evaluate((key) => {
    const kept = localStorage.getItem(key);
    return kept === null
      ? undefined
      : (JSON.parse(kept) as { changes: KeptChange[] }).changes;
  }, draftKey);
}

/** The outline of a Field the Draft changed over a Limit (L3). */
export const red = 'rgb(220, 38, 38)';
/** The outline of a Field over a Limit as published (L7). */
export const amber = 'rgb(217, 119, 6)';

/** The Site's elements that show the Field at `path`, on the page or in the preview. */
export function field(page: Page | FrameLocator, path: string): Locator {
  return page.locator(`[data-edity-field="${path}"]`);
}

/** The text of the first Field of each Item of the List at `path`. */
export function texts(
  page: Page | FrameLocator,
  path: string,
): Promise<string[]> {
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

/** Puts the caret at the end of a Field's text. */
export async function caretAtEnd(locator: Locator): Promise<Locator> {
  await locator.evaluate((element) => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  return locator;
}

/** Clicks into the Field at `path` and selects its text. */
export async function editAll(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  await locator.click();
  await expect(locator).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  return locator;
}

/** Clicks into the Field at `path` and puts the caret at its end. */
export async function editAtEnd(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  await locator.click();
  await expect(locator).toBeFocused();
  return caretAtEnd(locator);
}

/**
 * Clicks into the Field at `path`, so its Item's controls show. It clicks
 * near the text's start: the controls of the Item below, which sit above
 * that Item's end, can cover this one's on a phone.
 */
export async function focusField(page: Page, path: string): Promise<Locator> {
  const locator = field(page, path).first();
  const box = (await locator.boundingBox())!;
  await locator.click({ position: { x: 4, y: box.height / 2 } });
  await expect(locator).toBeFocused();
  return locator;
}

/**
 * The lines a block element takes on the page, from its height and line
 * height: a measure apart from the Editor's, right for plain text in one
 * font.
 */
export function lines(block: Locator): Promise<number> {
  return block.evaluate((element) =>
    Math.round(
      (element as HTMLElement).offsetHeight /
        parseFloat(getComputedStyle(element).lineHeight),
    ),
  );
}
