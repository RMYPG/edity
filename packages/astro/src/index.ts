import type { AstroIntegration } from 'astro';
import type { HelperOptions } from './editable.js';

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
   * `<template>`. Defaults to `true`.
   */
  readonly enabled?: boolean;
}

/**
 * The Edity integration: add it to `integrations` in `astro.config.mjs`, then
 * mark editable elements up with `editable()` from `@edity/astro/editable`
 * and `<Items>` from `@edity/astro/Items.astro`.
 */
export default function edity(options: EdityOptions = {}): AstroIntegration {
  const helpers: HelperOptions = { enabled: options.enabled ?? true };
  return {
    name: '@edity/astro',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            define: { __EDITY_OPTIONS__: JSON.stringify(helpers) },
          },
        });
      },
    },
  };
}
