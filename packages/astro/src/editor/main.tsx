// The Editor bundle's entry point. The inline check imports it, from
// /_edity/editor.<hash>.js, when the browser carries the edity=1 marker cookie.
import { effect } from '@preact/signals';
import { render } from 'preact';
import { markup } from '../markup.js';
import { getSession } from './api.js';
import { fitsDraft } from './content.js';
import { editorRoot, readPage } from './documents.js';
import { draftStore, keepDraft, type DraftStore } from './draft-store.js';
import { Editor } from './Editor.js';
import { editFields } from './fields.js';
import { editLists } from './lists.js';
import { previewReady } from './Preview.js';
import { restoreDraft } from './show-draft.js';
import { createEditorState, type Editing } from './state.js';
import { watchLimits } from './watch-limits.js';

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
      // Before anything reads them: a kept Change its Field or List could
      // never hold would break the Editor on every page load.
      const kept = store?.load() ?? [];
      const changes = kept.filter(
        (change) => page !== undefined && fitsDraft(page.fields, change),
      );
      const state = createEditorState({
        session: result.session,
        page,
        languages: navigator.languages,
        changes,
      });
      const fields = editFields(state);
      const editing: Editing = {
        state,
        fields,
        lists: editLists(state, fields),
        limits: watchLimits(state, fields),
      };
      if (store !== undefined) {
        restore(editing, store, kept.length - changes.length);
      }
      mount(editing);
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
 * of its Changes no longer apply, `dropped` already among them, and keeps the
 * Draft there from now on.
 */
function restore(editing: Editing, store: DraftStore, dropped: number): void {
  const { draft, notApplied } = editing.state;
  notApplied.value = dropped + restoreDraft(editing);
  keepDraft(draft, store);
  // The notice is about the Draft as restored: it goes once the Client
  // changes it.
  const restored = draft.changes.peek();
  effect(() => {
    if (draft.changes.value !== restored) notApplied.value = 0;
  });
}

/** Renders the Editor into one open shadow root, after the page's <body>. */
function mount(editing: Editing): void {
  render(<Editor editing={editing} />, editorRoot(document));
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
