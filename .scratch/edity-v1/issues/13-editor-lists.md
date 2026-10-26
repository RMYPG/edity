# 13. Editing Lists

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 11
Covers: S1, S2, S3, S4, S5, S6, S7 (see the [spec](../spec.md))

## What to build

Let the Client add, remove and reorder Items within the List's bounds: controls disabled at the bounds with the reason, drag (mouse anywhere outside text, touch with a handle) and arrow buttons, new Items from the build's `<template>`, Enter and Backspace in simple Lists, one level of nesting, a short Undo after removing. Any structural edit makes the whole List one Change; Field edits in an unchanged List stay separate Changes.

## Acceptance criteria

- [x] Each of S1 to S7 has a passing browser test
- [ ] Reordering on iOS Safari works with the handle

## Comments

2026-10-25: Built in `packages/astro/src/editor/`: `lists.ts` edits the Site's List elements, `ListControls.tsx` (with `lists.css`) shows the controls in the shadow root, and the pure `list-changes.ts` and `drop.ts` work out the Draft's Changes and where a dragged Item goes. The active Item (under the mouse, else last focused or tapped) gets a handle, move and remove buttons, and its Lists get an add button, disabled at the bounds with the reason shown (S1). A mouse drags an Item from anywhere outside text, any pointer from the handle (`touch-action: none`, pointer capture on the List), and the handle also takes the arrow keys (S2). New Items are cloned from the build's `<template>` and every path is renumbered, nested templates included (S3). Enter splits a simple List's Item and Backspace removes an empty one (S4); nested Lists work the same (S5); a removal offers Undo for 6 s, kept while pointed at (S6). A List whose structure differs from the build is one Change with every Item before and after, and Field edits inside it update that Change; while it is as built, each Field is a Change of its own (S7). Discard puts Lists back before Fields, and `isWellFormed` checks List Changes, so a new Item with blank Fields keeps Publish disabled. `test/browser/editor-lists.spec.ts` covers S1 to S7, Discard, the visitor view and the controls' language in all four projects; the guards were checked by removing them. Not ticked: iOS Safari. In Playwright's WebKit with iPhone emulation, synthetic touch pointer events on the handle reorder the Items and the handle computes `touch-action: none` and `user-select: none`, and in Chromium a real CDP touch drag reorders them without scrolling the page. But Playwright cannot send real touch moves to WebKit, and Linux WebKit does not know `-webkit-touch-callout`, so iOS gesture handling is untested. Real iOS Safari is checked in the device pass (ticket 29). Left over: keyboard users reach the controls only after the page's last Field, because Tab moves between Fields (E8), which is for ticket 29 (N7) to judge.

2026-10-26: Backspace on an empty Item now offers the same Undo as the remove button (S6), with a browser test. Dragging moved to `list-drag.ts`, the Undo's timing to `undo-offer.ts` and the List elements' helpers to `list-elements.ts`; the blank Item is built once, by `blankValue()` in `packages/astro/src/markup.ts`, which the build's template and the Editor's new Items share.

2026-10-26: A List Change now keeps `origins`, which built Item each Item of its `after` is (codex review fix, `changeOrigins` in `list-changes.ts`). The Draft keeps them in the browser and Publish does not send them. A restored List trusts them while the List as built still equals the Change's `before`, and matches Items by value otherwise. So an edited Item that was moved is still the same Item after a reload, and moving it back leaves one Field Change (S7). `isChanged` counts a built Item as unchanged only when it holds its built value.
