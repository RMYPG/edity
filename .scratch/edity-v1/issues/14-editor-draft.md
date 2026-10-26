# 14. Draft in the browser

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 11, 13
Covers: P1, P2, P3 (see the [spec](../spec.md))

## What to build

Keep the Draft in `localStorage`, per Site and page, and restore it after a reload or a closed tab. On restore, drop Changes to Fields or Lists that no longer exist in the page's markup and tell the Client how many were dropped. Discard clears the Draft. Build the Publish payload: only the Changes, each with its `before` and `after` values.

## Acceptance criteria

- [x] Reloading mid-edit restores every Change and the count
- [x] A Draft with a Change to a removed Field restores the rest and shows "1 change no longer applies"
- [ ] The payload matches the OpenAPI request schema (ticket 18) once it exists

## Comments

2026-10-25: Built in `packages/astro/src/editor/`. `draft-store.ts` keeps each page's Draft in `localStorage` under `edity:draft:v1:<site>:<page>` (the session's Site and the page marker's name), with every access in `try/catch`, and `keepDraft()` saves it on every change; Discard empties it, which removes the key. `main.tsx` starts the Draft from the kept Changes, restores them through `showDraft()` (`restoreDraft()` in `show-draft.ts`), drops those whose Field or List the page no longer has, and shows a notice above the bar ("1 cambio ya no se aplica" / "1 change no longer applies") until the Client closes it or changes the Draft. `showDraft()` now shows List Changes too, in any document: `lists.show(path, value, root)` builds Items from the `<template>` in `root` and makes them editable only on the page, so the phone preview shows List Changes. Showing never records a Change, so a restored Draft stays as kept, and the Draft keeps each Change's `before` as the Client first changed it, across reloads and S7 transitions, for the server's Conflict check (V2); Discard and the preview put Fields back with the built value instead. L7 is finer too: a built Item that only moved in a restructured List shows as published, on the page and in the preview. The Publish body is `publishRequest(page, changes)` with the types `PublishRequest` and `PublishedChange` in `api.ts`, as the spec's API table gives it (`{ page, changes: [{ path, before, after }] }`), for ticket 18's generated client to replace; Publish itself is still unwired (ticket 26). `test/browser/editor-draft.spec.ts` covers both ticked criteria in all four projects. Not ticked: the OpenAPI file does not exist yet, so ticket 18 checks the payload against its request schema. Left over: two tabs on the same page each keep their own Draft and the last write wins (the `storage` event could sync them), and Discard still has no confirmation step.

2026-10-26: A kept Draft is checked against the page's Field definitions before anything reads it (codex review fix, `fitsDraft` in `content.ts`): a Change whose `before` or `after` its Field or List could never hold is dropped and counted in "N changes no longer apply". Before, a List Item that was not text crashed the restore on every reload, before the Editor (and its Discard) started.
