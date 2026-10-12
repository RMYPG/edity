# 12. Limits while typing

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 11
Covers: L1, L2, L3, L4, L5, L6, L7 (see the [spec](../spec.md))

## What to build

Show Limits as the Client types: visible-character counts, line counts per screen width (narrow value under the breakpoint), a counter that appears at 80%, red Field and disabled Publish when over, never blocking input. Re-check on resize, when fonts finish loading and in phone preview. Older content that already breaks a Limit shows a warning but only Fields changed in this Draft block Publish.

## Acceptance criteria

- [ ] Each of L1 to L7 has a passing browser test, including emoji and Spanish accents
- [ ] Line counts are measured on the real rendered element
