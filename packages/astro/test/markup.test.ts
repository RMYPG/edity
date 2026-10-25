import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildFixture, withoutEdity, type BuiltSite } from './build-fixture.js';

describe('the fixture Site built with Edity', () => {
  let withEdity: BuiltSite;
  let disabled: BuiltSite;
  let html: string;

  beforeAll(async () => {
    withEdity = await buildFixture();
    disabled = await buildFixture({ enabled: false });
    html = await withEdity.read('index.html');
  });

  afterAll(async () => {
    await withEdity?.remove();
    await disabled?.remove();
  });

  test('differs from the Site without Edity only by data- attributes and one template per List', async () => {
    const without = await disabled.read('index.html');

    expect(without).not.toContain('data-edity');
    expect(withoutEdity(html)).toBe(without);
  });

  test('has one template per List, holding a blank Item', () => {
    const lists = [...html.matchAll(/ data-edity-list="([^"]+)"/g)];
    const templates = [
      ...html.matchAll(/<template data-edity-template="([^"]+)">/g),
    ];

    expect(templates.map(([, path]) => path).sort()).toEqual(
      lists.map(([, path]) => path).sort(),
    );
    expect(lists.map(([, path]) => path).sort()).toEqual([
      'plans',
      'plans.0.features',
      'plans.1.features',
      // The nested List of the blank Item in the template of "plans".
      'plans.2.features',
      'services',
    ]);
    expect(html).toMatch(
      /<template data-edity-template="services"><li class="service" data-edity-item="services\.4" data-edity-field="services\.4" data-astro-cid-\w+><\/li><\/template><\/ul>/,
    );
  });

  test('marks a value shown in two places with the same path in both', () => {
    const brand = html.match(
      /<[a-z]+ [^>]*data-edity-field="brand\.name"[^>]*>Fisio Sandbox</g,
    );

    expect(brand).toHaveLength(2);
  });
});

test('a typo in a Field path fails the build and names the path', async () => {
  const build = buildFixture({
    routes: { '/typo': './src/broken/typo-in-field-path.astro' },
  });

  await expect(build).rejects.toThrow(
    'Unknown Field path "hero.titel" in page "home"',
  );
});
