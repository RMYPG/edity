import type { AstroIntegration } from 'astro';
import type { HelperOptions } from './editable.js';
import { editorBundle } from './editor-bundle.js';

export type {
  EditablePage,
  FieldPath,
  ItemScope,
  ListPath,
  ListScope,
  Marker,
  ObjectItem,
  PageEntry,
  PageMarker,
  TextItem,
} from './editable.js';

/** Options of the Edity integration. */
export interface EdityOptions {
  /**
   * `false` builds the Site as it would be without Edity: the template
   * helpers mark nothing, so there are no `data-edity-*` attributes and no
   * `<template>`, and there is no inline check or Editor bundle. Defaults to
   * `true`.
   */
  readonly enabled?: boolean;
  /**
   * The media query of narrow screens, where a text Field's `maxLinesNarrow`
   * applies instead of its `maxLines` (L2). Use the one the Site's CSS
   * switches to its phone layout at, such as `'(max-width: 480px)'`.
   * Defaults to `'(width < 600px)'`, which takes in phones held upright.
   */
  readonly narrowScreens?: string;
}

/** Screens narrower than most tablets: phones held upright. */
const narrowScreens = '(width < 600px)';

/**
 * The Edity integration: add it to `integrations` in `astro.config.mjs`, then
 * mark editable elements up with `editable()` from `@edity/astro/editable`
 * and `<Items>` from `@edity/astro/Items.astro`.
 */
export default function edity(options: EdityOptions = {}): AstroIntegration {
  const helpers: HelperOptions = {
    enabled: options.enabled ?? true,
    narrowScreens: mediaQuery(options.narrowScreens ?? narrowScreens),
  };
  return {
    name: '@edity/astro',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            define: { __EDITY_OPTIONS__: JSON.stringify(helpers) },
          },
          integrations: helpers.enabled ? [editorBundle()] : [],
        });
      },
    },
  };
}

function mediaQuery(query: unknown): string {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new TypeError(
      `[edity] narrowScreens must be a media query, such as '(max-width: 480px)', not ${JSON.stringify(query)}`,
    );
  }
  return query.trim();
}
