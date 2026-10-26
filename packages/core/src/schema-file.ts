import type { AnyFieldDefinitions } from './fields.js';
import { toJSONSchema } from './json-schema.js';

/**
 * The text of the JSON Schema file committed next to a page's content, in
 * canonical form: object keys sorted at every level, two-space indentation, a
 * list of Field names on one line when it fits in 80 columns, and a final
 * newline. The same Field definitions always give the same bytes, whatever
 * order Zod writes keywords in, and Prettier's default JSON formatting leaves
 * the file as it is.
 */
export function toSchemaFile(fields: AnyFieldDefinitions): string {
  return serialize(toJSONSchema(fields));
}

/**
 * Whether a committed JSON Schema file still matches a page's Field
 * definitions. It compares the file's JSON, not its bytes, so a file a
 * formatter rewrote, or checked out with CRLF line endings, still matches. A
 * file that is not JSON does not match.
 */
export function schemaFileMatches(
  committed: string,
  fields: AnyFieldDefinitions,
): boolean {
  let json: unknown;
  try {
    json = JSON.parse(committed);
  } catch {
    return false;
  }
  return serialize(json) === toSchemaFile(fields);
}

function serialize(json: unknown): string {
  return `${print(json, '', printWidth)}\n`;
}

const printWidth = 80;
const indentation = '  ';

/**
 * Prints a JSON value with its object keys sorted, as Prettier formats JSON
 * written by `JSON.stringify(value, null, 2)`: objects stay expanded, and a
 * list of plain values goes on one line when it fits in `width`, the columns
 * left on its line. That covers what a schema file holds. Prettier measures
 * East Asian wide characters as two columns and fills long lists of numbers,
 * so it could reformat a file with those, which still matches.
 */
function print(value: unknown, indent: string, width: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isScalar)) {
      const line = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (line.length <= width) return line;
    }
    const inner = indent + indentation;
    const items = value.map(
      (item, i) =>
        inner + print(item, inner, rest(inner, i < value.length - 1)),
    );
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort();
    if (keys.length === 0) return '{}';
    const inner = indent + indentation;
    const lines = keys.map((key, i) => {
      const head = `${inner}${JSON.stringify(key)}: `;
      return head + print(object[key], inner, rest(head, i < keys.length - 1));
    });
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** The columns left after `head`, keeping one for a comma if one follows. */
function rest(head: string, comma: boolean): number {
  return printWidth - head.length - (comma ? 1 : 0);
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}
