# 02. Field definition primitives

Status: resolved
Repo: RMYPG/edity
Milestone: M0
Blocked by: 01
Covers: L1, L2, L5, S1, S5 (see the [spec](../spec.md))

## What to build

In `packages/core`, add the primitives a Developer uses to write a page's Field definitions: `text({ maxChars, maxLines?, maxLinesNarrow? })`, `number({ min, max, decimals })` and `list(item, { min, max })`. An Item is either a single text Field or an object of Fields with at most one nested List. The primitives produce Zod 4 schemas so Astro content collections validate content and templates get full types.

## Acceptance criteria

- [x] `maxChars` counts visible characters (grapheme clusters via `Intl.Segmenter`), so `"Fisioterapia 🧑‍⚕️"` counts the emoji as one
- [x] Numbers enforce min, max and the exact number of decimals
- [x] Lists enforce min and max Items; nesting deeper than one level is a type error and a runtime error
- [x] Line Limits are stored as metadata only (they are checked in the browser, not in Zod)
- [x] Types inferred from a definition match the content shape exactly

## Notes

Terms: Field, List, Item, Limit, Field definitions (`CONTEXT.md`).

## Comments

2026-10-25: `packages/core/src/fields.ts` adds `text`, `number` and `list`, plus `defineFields` for a page's Field definitions (plain objects group Fields, as in `hero.title`), `definitionOf`, which reads back the Limits and the whole tree as frozen plain data (the walk for tickets 03, 07 and 12), and `graphemeCount` (`graphemes.ts`), the count `maxChars` uses. Every object is a `z.strictObject`, so unknown keys fail. An Item is a text Field or a flat object of Fields with at most one List, and Lists nest one level deep: anything else is a type error (branded types) and throws with the key named. Invalid Limits (such as `min > max`) throw too. `decimals` means at most that many decimal places, since JSON keeps no trailing zeros; the template formats exactly that many. `zod` is a peer dependency (`^4.6.0`, imported as `zod/v4` like `astro/zod`), so a Site lists `zod` itself and keeps one copy shared with Astro. Tests go through the package entry point, and Vitest also runs the type-level tests in `inference.test-d.ts`.

Text Fields are required and single-line, since the spec defers Fields that can be left empty and stores single-paragraph text: `text()` rejects a value with no visible character or with a line break (`\n`, `\r`, U+2028, U+2029), through a `.regex()` that Zod emits as a JSON Schema `pattern` written to mean the same in ECMA-262 (`u` flag) and Go's RE2.

Left over: `@edity/astro` will need `zod` as a peer dependency too once it uses core (ticket 07).
