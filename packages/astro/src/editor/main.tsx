// The Editor bundle's entry point. The inline check imports it, from
// /_edity/editor.<hash>.js, when the browser carries the edity=1 marker cookie.
import { render } from 'preact';
import { getSession } from './api.js';
import { editorRoot, readPage } from './documents.js';
import { Editor } from './Editor.js';
import { editFields, type Fields } from './fields.js';
import { previewReady } from './Preview.js';
import { createEditorState, type EditorState } from './state.js';
import { watchLimits, type Limits } from './watch-limits.js';

// Only the top window runs the Editor. A same-origin frame sends the marker
// cookie too, so the inline check loads this bundle there as well. In the
// phone preview's frame, the Editor of the page around it shows the Draft.
if (window.top === window) void start();
else if (window.frameElement?.hasAttribute('data-edity-preview')) {
  void startPreview();
}

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
        page: readPage(document),
        languages: navigator.languages,
      });
      const fields = editFields(state);
      mount(state, fields, watchLimits(state, fields));
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

/**
 * Tells the page around the phone preview's frame that the frame's page is
 * parsed, so it shows the Draft there before the page's images load. It
 * asks the server for nothing.
 */
async function startPreview(): Promise<void> {
  await parsed();
  window.frameElement?.dispatchEvent(new Event(previewReady));
}

/** Renders the Editor into one open shadow root, after the page's <body>. */
function mount(state: EditorState, fields: Fields, limits: Limits): void {
  render(
    <Editor state={state} fields={fields} limits={limits} />,
    editorRoot(document),
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
