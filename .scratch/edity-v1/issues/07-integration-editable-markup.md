# 07. Astro integration: editable markup

Status: resolved
Repo: RMYPG/edity
Milestone: M1
Blocked by: 02
Covers: S3, N2 (see the [spec](../spec.md))

## What to build

In `packages/astro`, add the integration and the template helpers a Developer uses to mark editable elements. Helpers add `data-edity-*` attributes that tie each element to a Field path. Each List gets one hidden `<template>` with a blank Item rendered by the build, so the Editor can add Items with real markup.

## Acceptance criteria

- [x] A typo in a Field path fails the build and names the path
- [x] The built HTML differs from the same Site without Edity only by `data-` attributes, the inline check (ticket 09) and one `<template>` per List
- [x] A value shown in two places carries the same path in both, so the Editor can update both (E7)

## Comments

2026-10-25: Built in `packages/astro`. `editable(fields, entry)` from `@edity/astro/editable` returns the values for single static attributes: `data-edity-page` (JSON with the page name, its Field definitions and its content), `data-edity-field`, `data-edity-list` and `data-edity-item`. Each value is a path in the content JSON's own structure, such as `plans.1.features.0`. `<Items of={list}>` from `@edity/astro/Items.astro` renders a List's Items, then one `<template data-edity-template>` holding a blank Item at the next index. The helpers return values, never spread objects, because Astro adds `class="astro-<hash>"` to spread elements in components with scoped styles, which N2 does not allow. `edity({ enabled: false })` makes every helper return `undefined`. The tests build the fixture Site (`packages/astro/test/fixture/`, part of the workspace) both ways and compare the HTML: it matches once templates and `data-edity-*` attributes are removed. The inline check does not exist yet: ticket 09 extends `withoutEdity()` in `test/build-fixture.ts`. A typo in a path fails `astro build` with `Unknown Field path "hero.titel" in page "home"`. It is also a type error under `astro check`, which runs in the fixture's build. Left for later: no build-time scan yet checks that Items are direct children of their List element, or that `data-edity-page` is present.

