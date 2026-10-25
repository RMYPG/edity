// The Editor bundle's entry point. The inline check imports it, from
// /_edity/editor.<hash>.js, when the browser carries the edity=1 marker cookie.
import { render } from 'preact';
import type { PageMarker } from '../editable.js';
import { getSession } from './api.js';
import { Editor } from './Editor.js';
import css from './editor.css?inline';
import { editFields, type Fields } from './fields.js';
import { editLists, type Lists } from './lists.js';
import { createEditorState, type EditorState } from './state.js';
import { watchLimits, type Limits } from './watch-limits.js';

// Only the top window runs the Editor. A same-origin frame, such as ticket
// 15's phone preview, sends the marker cookie too, so the inline check loads
// this bundle there as well.
// TODO(ticket 15): start the preview instead when the frame element carries
// data-edity-preview.
if (window.top === window) void start();

/**
 * Starts the Editor once the server confirms the session (A4). Until then
 * the page is exactly as a visitor sees it, and on a 401 it stays so.
 */
async function start(): Promise<void> {
  // Asked at once, while the browser may still be parsing the page.
  const session = getSession();
  await parsed();
  const result = await session;
  switch (result.status) {
    case 'signed-in': {
      const state = createEditorState({
        session: result.session,
        page: readPage(),
        languages: navigator.languages,
      });
      const fields = editFields(state);
      mount(
        state,
        fields,
        editLists(state, fields),
        watchLimits(state, fields),
      );
      return;
    }
    case 'signed-out':
      // Visitors from now on, until the Client logs in again.
      document.cookie = 'edity=; Path=/; Max-Age=0; SameSite=Lax';
      return;
    case 'unavailable':
      // Perhaps for a moment, so the marker stays for the next page load.
      console.warn(`[edity] The Editor did not start: ${result.reason}`);
      return;
  }
}

/** Renders the Editor into one open shadow root, after the page's <body>. */
function mount(
  state: EditorState,
  fields: Fields,
  lists: Lists,
  limits: Limits,
): void {
  // One unknown tag, which no Site CSS selects by name. The root is open so
  // browser tests can reach inside.
  const host = document.createElement('edity-root');
  const shadow = host.attachShadow({ mode: 'open' });
  // A constructed sheet, which a Site's CSP style-src does not apply to.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  shadow.adoptedStyleSheets = [sheet];
  // Not in <body>, where it would change what the Site's :last-child and
  // flex or grid rules apply to.
  document.documentElement.append(host);
  render(
    <Editor state={state} fields={fields} lists={lists} limits={limits} />,
    shadow,
  );
}

/** Resolves once the browser has parsed the page: import() can come first. */
function parsed(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) =>
    document.addEventListener('DOMContentLoaded', () => resolve(), {
      once: true,
    }),
  );
}

/** What the page's `data-edity-page` marker holds, if it has one. */
function readPage(): PageMarker | undefined {
  const json =
    document.querySelector<HTMLElement>('[data-edity-page]')?.dataset.edityPage;
  return json === undefined ? undefined : (JSON.parse(json) as PageMarker);
}
