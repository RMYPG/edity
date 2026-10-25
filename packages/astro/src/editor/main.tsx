// The Editor bundle's entry point. The inline check imports it, from
// /_edity/editor.<hash>.js, when the browser carries the edity=1 marker cookie.
import { effect } from '@preact/signals';
import { render } from 'preact';
import { markup } from '../markup.js';
import { getSession } from './api.js';
import { editorRoot, readPage } from './documents.js';
import { draftStore, keepDraft, type DraftStore } from './draft-store.js';
import { Editor } from './Editor.js';
import { editFields, type Fields } from './fields.js';
import { editLists, type Lists } from './lists.js';
import { previewReady } from './Preview.js';
import { restoreDraft } from './show-draft.js';
import { createEditorState, type EditorState } from './state.js';
import { watchLimits, type Limits } from './watch-limits.js';

// Only the top window runs the Editor. A same-origin frame sends the marker
// cookie too, so the inline check loads this bundle there as well. In the
// phone preview's frame, the Editor of the page around it shows the Draft.
if (window.top === window) void start();
else if (window.frameElement?.hasAttribute(markup.preview)) {
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
      const page = readPage(document);
      // The Draft is kept per Site and page (P2).
      const store =
        page === undefined
          ? undefined
          : draftStore(result.session.site, page.page);
      const state = createEditorState({
        session: result.session,
        page,
        languages: navigator.languages,
        changes: store?.load(),
      });
      const fields = editFields(state);
      const lists = editLists(state, fields);
      const limits = watchLimits(state, fields);
      if (store !== undefined) restore(state, fields, lists, store);
      mount(state, fields, lists, limits);
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

/**
 * Shows the Draft kept in the browser on the page, tells the Client how many
 * of its Changes no longer apply, and keeps the Draft there from now on.
 */
function restore(
  { draft, notApplied }: EditorState,
  fields: Fields,
  lists: Lists,
  store: DraftStore,
): void {
  notApplied.value = restoreDraft(draft, fields, lists);
  keepDraft(draft, store);
  // The notice is about the Draft as restored: it goes once the Client
  // changes it.
  const restored = draft.changes.peek();
  effect(() => {
    if (draft.changes.value !== restored) notApplied.value = 0;
  });
}

/** Renders the Editor into one open shadow root, after the page's <body>. */
function mount(
  state: EditorState,
  fields: Fields,
  lists: Lists,
  limits: Limits,
): void {
  render(
    <Editor state={state} fields={fields} lists={lists} limits={limits} />,
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
