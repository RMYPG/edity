import { expect, recordRequests, test } from './editor.js';

test('without the edity=1 cookie, a page makes no request beyond itself (N1)', async ({
  page,
}) => {
  const requests = recordRequests(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The fixture page loads nothing of its own: no CSS, script or image file.
  expect(requests).toEqual(['/']);
  await expect(page.locator('edity-root')).toHaveCount(0);
});

test('a cookie that only looks like edity=1 does not load the Editor', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: 'xedity', value: '1', url: baseURL! },
    { name: 'edity', value: '10', url: baseURL! },
  ]);
  const requests = recordRequests(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(requests).toEqual(['/']);
});

test('with the edity=1 cookie, the page loads the Editor bundle from its own origin (A4)', async ({
  page,
  context,
  baseURL,
  signIn,
  bar,
}) => {
  await context.addCookies([{ name: 'consent', value: 'yes', url: baseURL! }]);
  await signIn();
  const bundle = page.waitForResponse((response) =>
    /\/_edity\/editor\.[0-9a-f]{10}\.js$/.test(response.url()),
  );

  await page.goto('/');

  const response = await bundle;
  expect(new URL(response.url()).origin).toBe(new URL(baseURL!).origin);
  expect(response.status()).toBe(200);
  // The bundle ran: the Editor rendered its bar into its shadow root.
  await expect(bar).toBeVisible();
});
