// The phone preview (P6): the page in a frame 390 px wide, as a phone shows
// it, with the Draft in it and its Limits checked there (L6). The frame loads
// the page again from the Site, so the Site's own CSS for narrow screens
// applies, media queries included. The Editor does not start in the frame
// (main.tsx): the page's Editor shows the Draft there, and nothing in the
// frame is editable.
import { effect, untracked, type Signal } from '@preact/signals';
import { render } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { Counters } from './Counters.js';
import { editorRoot, readPage } from './documents.js';
import type { Change } from './draft.js';
import type { Fields } from './fields.js';
import type { Messages } from './i18n.js';
import type { Lists } from './lists.js';
import { draftDelta, showDraft } from './show-draft.js';
import type { EditorState } from './state.js';
import type { Limits } from './watch-limits.js';

/** What the preview's frame sends its element once its page is parsed. */
export const previewReady = 'edity-preview-ready';

/**
 * Screens that show the page at about a phone's width already. The bar has
 * no toggle there (editor.css), and the preview closes.
 */
const phoneScreens = '(max-width: 560px)';

interface ToggleProps {
  /** Whether the preview shows. */
  readonly open: Signal<boolean>;
  readonly t: Messages;
}

/** The bar's button that shows and hides the preview. */
export function PreviewToggle({ open, t }: ToggleProps) {
  return (
    <button
      type="button"
      class="tool preview-toggle"
      aria-pressed={open.value}
      onClick={() => (open.value = !open.value)}
    >
      <PhoneIcon />
      <span class="label">{t.phonePreview}</span>
    </button>
  );
}

interface Props {
  /** Whether the preview shows: it closes on a phone's width. */
  readonly open: Signal<boolean>;
  readonly state: EditorState;
  readonly fields: Fields;
  readonly lists: Lists;
  readonly limits: Limits;
}

/** The preview: the page as a phone shows it, with the Draft. */
export function Preview({ state, fields, lists, limits, open }: Props) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  // A layout effect runs before the frame can load, so no event is missed.
  useLayoutEffect(() => {
    const phone = matchMedia(phoneScreens);
    const close = () => {
      if (phone.matches) open.value = false;
    };
    close();
    phone.addEventListener('change', close);
    const stop = showIn(frame.current!, state, fields, lists, limits);
    return () => {
      phone.removeEventListener('change', close);
      stop();
    };
  }, []);
  return (
    <div class="preview">
      <iframe
        ref={frame}
        data-edity-preview=""
        src={location.pathname + location.search}
        title={state.t.phonePreview}
      />
    </div>
  );
}

/**
 * Shows the Draft in each page `frame` loads, from when it is parsed or, if
 * this bundle does not run there, loaded. Returns a function that stops.
 */
function showIn(
  frame: HTMLIFrameElement,
  state: EditorState,
  fields: Fields,
  lists: Lists,
  limits: Limits,
): () => void {
  let shown: { readonly document: Document; stop(): void } | undefined;
  const loaded = () => {
    const document = frame.contentDocument;
    if (
      document === null ||
      document === shown?.document ||
      document.readyState === 'loading' ||
      document.URL === 'about:blank'
    ) {
      return;
    }
    shown?.stop();
    shown = {
      document,
      stop: showPage(document, state, fields, lists, limits),
    };
  };
  frame.addEventListener(previewReady, loaded);
  frame.addEventListener('load', loaded);
  return () => {
    frame.removeEventListener(previewReady, loaded);
    frame.removeEventListener('load', loaded);
    shown?.stop();
    shown = undefined;
  };
}

/**
 * Shows the Draft in the preview's `document`, follows it as it changes, and
 * checks the Limits of its Fields there, with counters. Returns a function
 * that stops.
 */
function showPage(
  document: Document,
  { draft, page, locale, t }: EditorState,
  fields: Fields,
  lists: Lists,
  limits: Limits,
): () => void {
  // A desktop's scroll bar would take some 15 px of the 390, and a phone's
  // takes none.
  const sheet = new document.defaultView!.CSSStyleSheet();
  sheet.replaceSync(
    'html { scrollbar-width: none } html::-webkit-scrollbar { display: none }',
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  // A link in the frame can lead to another page, which shows as published:
  // the Draft is this page's.
  if (page === undefined || readPage(document)?.page !== page.page) {
    return () => {};
  }

  let showing: ReadonlyMap<string, Change> = new Map();
  const stopShowing = effect(() => {
    const changes = draft.changes.value;
    untracked(() =>
      showDraft(
        fields,
        lists,
        draftDelta(showing, changes, page.content),
        document,
      ),
    );
    showing = changes;
  });
  const stopChecking = limits.watch(document);
  const counters = editorRoot(document);
  render(
    <div class="edity" lang={locale}>
      <Counters limits={limits} t={t} of={document} />
    </div>,
    counters,
  );

  return () => {
    stopShowing();
    stopChecking();
    render(null, counters);
    counters.host.remove();
  };
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}
