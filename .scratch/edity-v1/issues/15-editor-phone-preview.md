# 15. Phone preview

Status: resolved
Repo: RMYPG/edity
Milestone: M2
Blocked by: 12
Covers: P6, L6 (see the [spec](../spec.md))

## What to build

Add a phone-width preview that shows the Draft at 390 px, with Limits re-checked at that width.

## Acceptance criteria

- [x] The preview shows the current Draft, not the published content
- [x] A line Limit that only breaks on narrow screens shows in the preview

## Notes

Priority: Should.

## Comments

2026-10-25: Built in `packages/astro/src/editor/`. A "Vista de móvil" / "Phone preview" toggle in the bar (`aria-pressed`, hidden at 560 px and below, where the page is already about a phone's width) opens a panel with an `<iframe data-edity-preview>` 390 px wide that loads the page again, so the Site's own media queries apply (`Preview.tsx`). In the frame the bundle does not start the Editor: it only tells the page it is parsed (`startPreview()` in `main.tsx`), with the frame's `load` as a fallback, and the frame asks the server for nothing. The page's Editor then shows the Draft in the frame and follows every Change, Discard included, through `showDraft()` and `draftDelta()` in `show-draft.ts`: the one place that puts a Draft into a document, which ticket 14's restore can reuse (it returns the Changes with no element, to drop and count). It also watches the frame's Limits with `limits.watch()`, so a changed Field over its narrow line Limit turns red there, with a counter rendered into the frame (`Counters` now takes the document, and `documents.ts` builds the Editor's shadow root in any document), and Publish stays disabled until the preview closes. A link in the frame to another page shows that page as published. `test/browser/editor-preview.spec.ts` covers both criteria in Chromium, Firefox and WebKit (the wide-screen tests skip on the iPhone project, which has no toggle). Removing the Draft step or the Limits watch makes them fail. Left over: List Changes do not show in the preview yet (`TODO(ticket 14)` in `showDraft`, which needs ticket 13's code to build Items in any document), and the preview measures with the desktop's fonts, so its line counts approximate a phone's.
