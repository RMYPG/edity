# 02. Field definition primitives

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M0
Blocked by: 01
Covers: L1, L2, L5, S1, S5 (see the [spec](../spec.md))

## What to build

In `packages/core`, add the primitives a Developer uses to write a page's Field definitions: `text({ maxChars, maxLines?, maxLinesNarrow? })`, `number({ min, max, decimals })` and `list(item, { min, max })`. An Item is either a single text Field or an object of Fields with at most one nested List. The primitives produce Zod 4 schemas so Astro content collections validate content and templates get full types.

## Acceptance criteria

- [ ] `maxChars` counts visible characters (grapheme clusters via `Intl.Segmenter`), so `"Fisioterapia 🧑‍⚕️"` counts the emoji as one
- [ ] Numbers enforce min, max and the exact number of decimals
- [ ] Lists enforce min and max Items; nesting deeper than one level is a type error and a runtime error
- [ ] Line Limits are stored as metadata only (they are checked in the browser, not in Zod)
- [ ] Types inferred from a definition match the content shape exactly

## Notes

Terms: Field, List, Item, Limit, Field definitions (`CONTEXT.md`).
