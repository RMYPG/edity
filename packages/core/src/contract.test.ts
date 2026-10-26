import { readdirSync, readFileSync } from 'node:fs';
import { Ajv2020, type AnySchemaObject } from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';
import {
  decimalPlaces,
  defineFields,
  definitionOf,
  graphemeCount,
  list,
  number,
  text,
  toJSONSchema,
  violations,
  type JSONSchema,
} from '@edity/core';

// The content contract (ADR-0005): the meta-schemas of the Edity dialect and
// the conformance fixtures, which the save service passes too.
const contracts = new URL('../../../contracts/', import.meta.url);

/** A case of the JSON Schema Test Suite format. */
interface Case {
  description: string;
  schema: JSONSchema;
  tests: { description: string; data: unknown; valid: boolean }[];
}

function readJSON(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, contracts), 'utf8'));
}

function fixtures(kind: string): [string, Case[]][] {
  return readdirSync(new URL(`fixtures/${kind}/`, contracts))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [name, readJSON(`fixtures/${kind}/${name}`) as Case[]]);
}

/**
 * JSON Schema 2020-12 with the Limits vocabulary, whose keywords count with
 * core's own rules. Strict mode makes Ajv refuse a keyword it does not know,
 * since it ignores `$vocabulary`.
 */
function edityValidator(): Ajv2020 {
  const ajv = new Ajv2020({ strict: true });
  ajv.addMetaSchema(readJSON('meta/limits.json') as AnySchemaObject);
  ajv.addMetaSchema(readJSON('meta/schema.json') as AnySchemaObject);
  ajv.addKeyword({
    keyword: 'x-edity-maxGraphemes',
    schemaType: 'number',
    validate: (max: number, data: unknown) =>
      typeof data !== 'string' || graphemeCount(data) <= max,
  });
  ajv.addKeyword({
    keyword: 'x-edity-decimals',
    schemaType: 'number',
    validate: (decimals: number, data: unknown) =>
      typeof data !== 'number' || decimalPlaces(data) <= decimals,
  });
  // Annotations: the Editor measures rendered lines.
  ajv.addKeyword({ keyword: 'x-edity-maxLines', schemaType: 'number' });
  ajv.addKeyword({ keyword: 'x-edity-maxLinesNarrow', schemaType: 'number' });
  return ajv;
}

const ajv = edityValidator();

test('the fixtures are the keyword fixtures and the page fixtures', () => {
  const kinds = readdirSync(new URL('fixtures/', contracts)).sort();

  expect(kinds).toEqual(['keywords', 'pages']);
});

describe.each(fixtures('keywords'))('keywords/%s', (_, cases) => {
  describe.each(cases)('$description', ({ schema, tests }) => {
    test.each(tests)('$description', ({ data, valid }) => {
      expect(ajv.compile(schema)(data)).toBe(valid);
    });
  });
});

// A page fixture holds a page's JSON Schema as core generates it. Core's own
// verdicts on a Draft come from the Field definitions, which the Site build
// validates with, and from `violations`, which the Editor checks with, so each
// Draft goes through those and through the JSON Schema, which the save
// service validates with. They must agree.
describe.each(fixtures('pages'))('pages/%s', (_, cases) => {
  describe.each(cases)('$description', ({ schema, tests }) => {
    const fields = fieldDefinitionsOf(schema);

    test('is the JSON Schema core generates for its Field definitions', () => {
      expect(toJSONSchema(fields)).toEqual(schema);
    });

    test.each(tests)('$description', ({ data, valid }) => {
      const verdicts = {
        fieldDefinitions: fields.safeParse(data).success,
        violations: violations(definitionOf(fields)!, data).length === 0,
        jsonSchema: ajv.compile(schema)(data),
      };

      expect(verdicts).toEqual({
        fieldDefinitions: valid,
        violations: valid,
        jsonSchema: valid,
      });
    });
  });
});

/**
 * Reads back the Field definitions a page's JSON Schema was generated from.
 * The test above checks the reading: generating the schema again gives the
 * fixture's schema.
 */
function fieldDefinitionsOf(schema: JSONSchema) {
  return defineFields(shapeOf(schema) as never);
}

type Node = ReturnType<typeof text | typeof number | typeof list> | Shape;

interface Shape {
  [key: string]: Node;
}

function shapeOf(schema: JSONSchema): Shape {
  const properties = schema.properties as Record<string, JSONSchema>;
  // `required` lists every Field in the order of the Field definitions.
  const keys = schema.required as string[];
  return Object.fromEntries(keys.map((key) => [key, nodeOf(properties[key]!)]));
}

function nodeOf(schema: JSONSchema): Node {
  const limit = (keyword: string) => schema[keyword] as number;
  switch (schema.type) {
    case 'string':
      return text({
        maxChars: limit('x-edity-maxGraphemes'),
        maxLines: limit('x-edity-maxLines'),
        maxLinesNarrow: limit('x-edity-maxLinesNarrow'),
      });
    case 'number':
    case 'integer':
      return number({
        min: limit('minimum'),
        max: limit('maximum'),
        decimals: schema.type === 'integer' ? 0 : limit('x-edity-decimals'),
      });
    case 'array':
      return list(nodeOf(schema.items as JSONSchema) as never, {
        min: limit('minItems'),
        max: limit('maxItems'),
      });
    case 'object':
      return shapeOf(schema);
    default:
      throw new TypeError(`Not a page schema: "type": ${String(schema.type)}`);
  }
}
