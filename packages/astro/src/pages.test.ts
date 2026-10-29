import { Ajv2020, type AnySchemaObject } from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { isPageName } from './pages.js';

test("isPageName takes the names that the pattern of Publish's page in edity-server's OpenAPI file takes", async () => {
  const openapi = parse(
    await readFile(new URL('../api/openapi.yaml', import.meta.url), 'utf8'),
  ) as {
    components: {
      schemas: {
        PublishRequest: { properties: { page: AnySchemaObject } };
      };
    };
  };
  const validPage = new Ajv2020({ strict: true }).compile(
    openapi.components.schemas.PublishRequest.properties.page,
  );

  for (const page of [
    ...['home', 'Precios', 'plan-2026', 'sobre_mi', '404'],
    ...['_borrador', '-home', 'mi página', 'blog/post', 'home.json', ''],
  ]) {
    expect(isPageName(page), page).toBe(validPage(page));
  }
});
