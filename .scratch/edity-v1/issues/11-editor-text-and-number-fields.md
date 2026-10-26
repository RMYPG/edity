# 11. Editing text and number Fields

Status: resolved
Repo: RMYPG/edity
Milestone: M2
Blocked by: 10
Covers: E1, E2, E3, E4, E5, E6, E7, E8 (see the [spec](../spec.md))

## What to build

Make Fields editable in place: hover marks (always faintly marked on touch), caret on click with no popover, plain text only (pasted formatting removed, line breaks become spaces), Enter leaves, Escape restores, number Fields accept digits and one comma or dot and store numbers, text in links and buttons is editable without following the link, values shown twice update together, Tab moves to the next Field.

## Acceptance criteria

- [x] Each of E1 to E8 has a passing browser test
- [x] Every edit is recorded as a Change in the Draft state (persistence is ticket 14)

## Comments

2026-10-25: Built in `packages/astro/src/editor/fields.ts` (with `fields.css`), on pure helpers in `values.ts` (a Field's value from its text, number parsing, pasting and the template's number format) and `content.ts` (definitions and built values by path, the Change a value makes). In the edit view every Field gets `contenteditable="plaintext-only"`, a hover mark (always a faint one on touch screens), a paste handler that keeps one line of plain text, Enter to leave, Escape to restore, a digits-and-one-separator filter on number Fields (shown without thousands separators while edited, reformatted on leaving), a capture-phase click guard for links and buttons, mirroring of values shown twice and Tab between Fields. Every input records a Change with `before` from the page's built content, and typing the built value back drops it (`draft.remove`). Discard puts the Fields back, and Publish stays disabled while a Change holds a blank text or no number. The visitor view removes every attribute and the sheet. `test/browser/editor-fields.spec.ts` has one or more tests per requirement in all four projects, and each guard was checked by removing it; the fixture's footer brand name is now inside a link. Left over: `TODO(ticket 13)` for Field edits inside a restructured List or a new Item, List Changes in `isWellFormed` and putting Lists back on Discard; the middle-click guard is untested; a Field the Client edits loses intentional non-breaking spaces; number Fields take no minus sign, as E5 says.

2026-10-26: `isWellFormed` now takes core's `violations()`, so a blank or multi-line text is judged as core and Zod judge it, not with `trim()`. A negative `min` is refused by `number()` itself now (E5).
