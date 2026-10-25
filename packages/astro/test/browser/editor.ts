// Fixtures for browser tests of the Editor. Import `test` and `expect` from
// here instead of from @playwright/test.
import {
  test as base,
  expect,
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
