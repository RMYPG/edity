import { Ajv2020, type AnySchemaObject } from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import openapi from '../../api/openapi.yaml?raw';
import { isPageName } from '../pages.js';
import { publishRequest } from './api.js';
import { Draft, type Change } from './draft.js';

/**
 * The schema at `pointer` in edity-server's pinned OpenAPI file, which is
 * JSON Schema 2020-12, as Ajv checks it.
 */
function schemaAt(pointer: string) {
  const ajv = new Ajv2020({ strict: true });
  // Ajv compiles the whole file to resolve its `$ref`s, so it has to take
  // the OpenAPI Object's own fields as keywords.
  ajv.addVocabulary([
    'openapi',
    'info',
    'jsonSchemaDialect',
    'servers',
    'paths',
    'webhooks',
    'components',
    'security',
    'tags',
    'externalDocs',
  ]);
  ajv.addSchema(parse(openapi) as AnySchemaObject, 'openapi.yaml');
  const validate = ajv.getSchema(`openapi.yaml#${pointer}`);
  if (validate === undefined) throw new Error(`No schema at ${pointer}`);
  return validate;
}

describe("Publish's request against the OpenAPI file", () => {
  const validRequest = schemaAt(
    '/paths/~1_edity~1api~1publish/post/requestBody/content/application~1json/schema',
  );
  /** A Draft with a Change of every kind, as the Editor records them. */
  const changes: Change[] = [
    // A text Field and a number Field.
    { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio en casa 🦴' },
    { path: 'visit.price', before: 35, after: 40.5 },
    // A Field of an Item, in a List whose structure is unchanged.
    { path: 'plans.1.features.0', before: 'Cuatro', after: 'Cinco sesiones' },
    // A List of texts, and a List of Items with a nested List.
    {
      path: 'services',
      before: ['Suelo pélvico', 'Punción seca'],
      after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
      origins: [1, 0, null],
    },
    {
      path: 'plans',
      before: [{ name: 'Básico', price: 19.99, features: ['Una sesión'] }],
      after: [
        { name: 'Básico', price: 19.99, features: ['Una sesión'] },
        { name: 'Completo', price: 49.5, features: ['Cuatro', 'Plan'] },
      ],
      origins: [0, null],
    },
  ];

  test("publishRequest's output is valid against the request schema", () => {
    const request = publishRequest(
      'home',
      new Draft(changes).changes.value.values(),
    );

    // As fetch sends it.
    const sent: unknown = JSON.parse(JSON.stringify(request));
    expect(validRequest(sent), JSON.stringify(validRequest.errors)).toBe(true);
  });

  test('the schema refuses the Changes as the Draft keeps them', () => {
    // So publishRequest has to leave out what only the Draft keeps.
    expect(validRequest({ page: 'home', changes })).toBe(false);
  });

  test('the integration builds only pages whose name the schema takes', () => {
    const change = { path: 'hero.title', before: 'Hola', after: 'Buenas' };
    for (const page of [
      ...['home', 'Precios', 'plan-2026', 'sobre_mi', '404'],
      ...['_borrador', '-home', 'mi página', 'blog/post', 'home.json', ''],
    ]) {
      const request = { page, changes: [change] };
      expect(isPageName(page), page).toBe(validRequest(request));
    }
  });
});

describe('publishRequest', () => {
  test("sends the page and only the Draft's Changes, each with its value before (P3)", () => {
    const draft = new Draft([
      // Kept from before a newer Release: the server tells the Conflict (V2).
      { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio en casa' },
      { path: 'visit.price', before: 35, after: 40 },
      {
        path: 'services',
        before: ['Suelo pélvico', 'Punción seca'],
        after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
        // Only the Draft keeps these.
        origins: [1, 0, null],
      },
    ]);

    const request = publishRequest('home', draft.changes.value.values());

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      page: 'home',
      changes: [
        { path: 'hero.title', before: 'Fisioterapia', after: 'Fisio en casa' },
        { path: 'visit.price', before: 35, after: 40 },
        {
          path: 'services',
          before: ['Suelo pélvico', 'Punción seca'],
          after: ['Punción seca', 'Suelo pélvico', 'Masaje'],
        },
      ],
    });
  });

  test('sends nothing but the path and the values of each Change', () => {
    const change = { path: 'hero.cta', before: 'Reserva', after: 'Pide cita' };
    const recorded = { ...change, extra: 'not sent' };

    const request = publishRequest('home', [recorded]);

    expect(request.changes).toEqual([change]);
  });
});
