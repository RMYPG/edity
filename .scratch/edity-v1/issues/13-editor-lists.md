# 13. Editing Lists

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M2
Blocked by: 11
Covers: S1, S2, S3, S4, S5, S6, S7 (see the [spec](../spec.md))

## What to build

Let the Client add, remove and reorder Items within the List's bounds: controls disabled at the bounds with the reason, drag (mouse anywhere outside text, touch with a handle) and arrow buttons, new Items from the build's `<template>`, Enter and Backspace in simple Lists, one level of nesting, a short Undo after removing. Any structural edit makes the whole List one Change; Field edits in an unchanged List stay separate Changes.

## Acceptance criteria

- [ ] Each of S1 to S7 has a passing browser test
- [ ] Reordering on iOS Safari works with the handle
