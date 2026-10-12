# 11. Editing text and number Fields

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 10
Covers: E1, E2, E3, E4, E5, E6, E7, E8 (see the [spec](../spec.md))

## What to build

Make Fields editable in place: hover marks (always faintly marked on touch), caret on click with no popover, plain text only (pasted formatting removed, line breaks become spaces), Enter leaves, Escape restores, number Fields accept digits and one comma or dot and store numbers, text in links and buttons is editable without following the link, values shown twice update together, Tab moves to the next Field.

## Acceptance criteria

- [ ] Each of E1 to E8 has a passing browser test
- [ ] Every edit is recorded as a Change in the Draft state (persistence is ticket 14)
