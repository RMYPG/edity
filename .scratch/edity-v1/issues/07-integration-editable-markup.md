# 07. Astro integration: editable markup

Status: ready-for-agent
Repo: RMYPG/edity
Milestone: M1
Blocked by: 02
Covers: S3, N2 (see the [spec](../spec.md))

## What to build

In `packages/astro`, add the integration and the template helpers a Developer uses to mark editable elements. Helpers add `data-edity-*` attributes that tie each element to a Field path. Each List gets one hidden `<template>` with a blank Item rendered by the build, so the Editor can add Items with real markup.

## Acceptance criteria

- [ ] A typo in a Field path fails the build and names the path
- [ ] The built HTML differs from the same Site without Edity only by `data-` attributes, the inline check (ticket 09) and one `<template>` per List
- [ ] A value shown in two places carries the same path in both, so the Editor can update both (E7)
