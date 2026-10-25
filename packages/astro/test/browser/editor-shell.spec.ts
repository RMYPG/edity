import { expect, recordRequests, test } from './editor.js';

test('with a session, the bar shows the Client, the Change count, Discard and a disabled Publish (P1)', async ({
  page,
  signIn,
  bar,
}) => {
  await signIn();
  await page.goto('/');

  await expect(bar).toHaveAccessibleName('Editor de Edity');
  await expect(bar).toContainText('Ana');
  await expect(bar.getByRole('status')).toHaveText('Sin cambios');
  await expect(bar.getByRole('button', { name: 'Descartar' })).toBeDisabled();
  await expect(bar.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  await expect(
    bar.getByRole('button', { name: 'Vista de visitante' }),
  ).toBeEnabled();
});

test('a 401 leaves the page exactly as a visitor sees it, and clears the marker cookie (A4)', async ({
  page,
  context,
  signIn,
  editor,
}) => {
  await page.goto('/');
  const visitorsPage = await page.content();
  await signIn({ status: 401 });

  await page.goto('/');

  await expect
    .poll(async () => (await context.cookies()).map(({ name }) => name))
    .not.toContain('edity');
  await expect(editor).toHaveCount(0);
  expect(await page.content()).toBe(visitorsPage);
  expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
  // From now on the browser is a visitor's: no Editor code loads.
  const requests = recordRequests(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual(['/']);
});

test('when the server cannot say who is signed in, the Editor does not start but keeps the marker cookie', async ({
  page,
  context,
  signIn,
  editor,
}) => {
  await signIn({ status: 503 });
  const session = page.waitForResponse('**/_edity/api/session');

  await page.goto('/');
  await session;
  await page.waitForLoadState('networkidle');

  await expect(editor).toHaveCount(0);
  expect((await context.cookies()).map(({ name }) => name)).toContain('edity');
});

test('in a frame on the same origin, which gets the marker cookie too, the Editor does not start', async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.route('**/framed', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Framed</title><iframe src="/" width="400" height="600"></iframe>',
    }),
  );
  const requests = recordRequests(page);
  const bundle = page.waitForResponse(/\/_edity\/editor\.[0-9a-f]{10}\.js$/);

  await page.goto('/framed');
  // The frame's inline check loaded the bundle, which then stopped.
  await bundle;
  await page.waitForLoadState('networkidle');

  expect(requests).not.toContain('/_edity/api/session');
  await expect(page.frameLocator('iframe').locator('edity-root')).toHaveCount(
    0,
  );
});

test('the visitor view hides every Editor control, and the bar comes back (P7)', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await page.goto('/');
  const visitorsHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await openEditor();

  await bar.getByRole('button', { name: 'Vista de visitante' }).click();

  await expect(bar).toHaveCount(0);
  // Only the way back is left.
  await expect(editor.getByRole('button')).toHaveText(['Volver a editar']);
  await expect(editor.getByRole('button')).toBeFocused();
  // And no room is kept for the bar at the end of the page.
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
    .toBe(visitorsHeight);

  await editor.getByRole('button', { name: 'Volver a editar' }).click();

  await expect(bar).toBeVisible();
  await expect(
    bar.getByRole('button', { name: 'Vista de visitante' }),
  ).toBeFocused();
});
