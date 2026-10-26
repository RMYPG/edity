// What the Editor reads from a document, and adds to it: the page itself,
// or the phone preview's frame (ticket 15).
import type { PageMarker } from '../editable.js';
import { markup, selector } from '../markup.js';
import css from './editor.css?inline';
import { adoptSheet } from './sheets.js';

/** What `document`'s `data-edity-page` marker holds, if it has one. */
export function readPage(document: Document): PageMarker | undefined {
  const json = document
    .querySelector(selector(markup.page))
    ?.getAttribute(markup.page);
  return json === undefined || json === null
    ? undefined
    : (JSON.parse(json) as PageMarker);
}

/**
 * Adds the Editor's own element to `document`, after its <body>, and returns
 * its open shadow root, with the Editor's styles, to render into.
 */
export function editorRoot(document: Document): ShadowRoot {
  // One unknown tag, which no Site CSS selects by name. The root is open so
  // browser tests can reach inside.
  const host = document.createElement('edity-root');
  const shadow = host.attachShadow({ mode: 'open' });
  adoptSheet(shadow, css);
  // Not in <body>, where it would change what the Site's :last-child and
  // flex or grid rules apply to.
  document.documentElement.append(host);
  return shadow;
}
