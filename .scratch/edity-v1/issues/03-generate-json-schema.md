# 03. Generate JSON Schema from Field definitions

Status: resolved
Repo: RMYPG/edity
Milestone: M0
Blocked by: 02
Covers: V1, N3 (see the [spec](../spec.md))

## What to build

Generate a JSON Schema 2020-12 document from a page's Field definitions, through Zod 4's `toJSONSchema`, extended with an Edity vocabulary for the Limits JSON Schema cannot express: `x-edity-maxGraphemes`, `x-edity-maxLines`, `x-edity-maxLinesNarrow` and `x-edity-decimals` (or `multipleOf` if exact). This file is what the server validates against (ADR-0002).

## Acceptance criteria

- [x] Output is deterministic (stable key order), so a stale-check can compare bytes
- [x] Every Limit from ticket 02 appears in the schema, using standard keywords where they mean exactly the same thing and Edity keywords otherwise
- [x] A helper reports whether a committed schema file matches the current definitions

## Notes

The vocabulary's meta-schema and conformance fixtures are ticket 16.

## Comments

2026-10-25: `packages/core/src/json-schema.ts` adds `toJSONSchema(fields)`. It runs Zod's `toJSONSchema` (2020-12, `io: "input"`) and writes every Limit from the definitions, through an `override`:
- `minimum`, `maximum`, `minItems` and `maxItems` where the standard keyword means the same thing.
- `"type": "integer"` for `decimals: 0`.
- `x-edity-maxGraphemes`, `x-edity-maxLines`, `x-edity-maxLinesNarrow` and `x-edity-decimals` otherwise. Never `maxLength` or a float `multipleOf`.

The root's `$schema` names the Edity dialect `https://github.com/RMYPG/edity/contracts/v1/schema`, so a validator that does not know the Limits vocabulary refuses the schema.

`schema-file.ts` adds `toSchemaFile(fields)`, the committed file in canonical form. Keys are sorted at every level, indentation is two spaces, and arrays go on one line when they fit in 80 columns. That is exactly Prettier's JSON output, so a Site needs no `.prettierignore` entry. It also adds `schemaFileMatches(committed, fields)`, the stale check for ticket 08. It compares JSON rather than bytes, so reformatting and CRLF line endings still match, and text that is not JSON does not. `AnyFieldDefinitions` types a parameter that takes any page's Field definitions.

Left over for ticket 16:
- The dialect meta-schema and the fixtures.
- A differential test of Zod against the generated schema.
- The draft `meta/limits.json` caps `x-edity-decimals` at 6, which `number()` does not.

Scratch runs of Ajv and santhosh-tekuri against the draft meta-schemas accepted a generated file and agreed on 20 cases.
