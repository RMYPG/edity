// Writes the Editor's types for edity-server's API, src/editor/openapi.ts,
// from the pinned OpenAPI file next to this script. `mise run api:generate`
// runs it, and with `--check` it fails instead if the committed file is not
// what the OpenAPI file generates.
import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString, oapiRef } from 'openapi-typescript';
import ts from 'typescript';

const input = new URL('openapi.yaml', import.meta.url);
const output = new URL('../src/editor/openapi.ts', import.meta.url);

const header = `/**
 * edity-server's API, as openapi-typescript generates it from the pinned
 * api/openapi.yaml. Do not edit: run \`mise run api:generate\`.
 */

`;

/** The interfaces that arrays of the schema they sit in refer to, by name. */
const arrays = new Map<string, ts.InterfaceDeclaration>();

const types = await openapiTS(input, {
  // Readonly, as the Editor's own types are.
  immutable: true,
  transform(schema, { path, ctx }) {
    // TypeScript resolves `components["schemas"]["X"]` at once, so an array
    // of X inside X itself, such as a List's Items in a ContentValue, refers
    // to itself. An interface that extends the array type defers it.
    if (schema.type !== 'array' || !('items' in schema)) return;
    const { items } = schema;
    if (!items || !('$ref' in items)) return;
    if (!path?.startsWith(`${items.$ref}/`)) return;
    const name = `${items.$ref.split('/').at(-1)}Array`;
    if (!arrays.has(name)) {
      const array = ts.factory.createInterfaceDeclaration(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        name,
        undefined,
        [
          ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(
              ts.factory.createIdentifier('ReadonlyArray'),
              [oapiRef(items.$ref)],
            ),
          ]),
        ],
        [],
      );
      arrays.set(name, array);
      ctx.injectFooter.push(array);
    }
    return ts.factory.createTypeReferenceNode(name);
  },
});
const generated = header + astToString(types);

const name = relative(process.cwd(), fileURLToPath(output));
if (process.argv.includes('--check')) {
  const committed = await readFile(output, 'utf8').catch(() => undefined);
  if (committed !== generated) {
    console.error(
      `${name} is not what ${relative(process.cwd(), fileURLToPath(input))} generates. Run \`mise run api:generate\`, then commit it.`,
    );
    process.exitCode = 1;
  }
} else {
  await writeFile(output, generated);
  console.log(`Wrote ${name}`);
}
