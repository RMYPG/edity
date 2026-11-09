# 06. Move fisioindoor content to JSON and Field definitions

Status: ready-for-human
Repo: RMYPG/fisioindoor
Milestone: M0
Blocked by: 03

## What to build

Do the Migration of `fisioindoor` by hand, on a branch (`main` must stay releasable, ADR-0003). Move `src/data/pricing.ts`, `services.ts` and the page's editable text into JSON content with Field definitions. Prices become numbers formatted by the template in `es-ES`; the per-session price is computed from the amount and the number of sessions instead of stored as text. Images stay in TS, joined to content by key. The Site is not connected to Edity yet.

## Acceptance criteria

- [x] The built Site looks the same as before (compare Playwright screenshots before and after)
- [x] `amount` values are numbers and the template formats `50 €`, `225 €`
- [x] "45 € por sesión" is computed, not stored
- [x] The a11y Playwright suite still passes

## Notes

Merge only when you are ready to release it; no Edity code runs on the page yet.

## Comments

2026-11-09: Built in draft [RMYPG/fisioindoor#43](https://github.com/RMYPG/fisioindoor/pull/43), with CI green. All 11 before-and-after screenshots are byte-identical. It stays open until you want to release it.
