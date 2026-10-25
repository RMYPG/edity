import { useSignal, type Signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Counters } from './Counters.js';
import { ListControls } from './ListControls.js';
import { Preview, PreviewToggle } from './Preview.js';
import { asBuilt, showDraft } from './show-draft.js';
import type { Editing, EditorState } from './state.js';

interface Props {
  /**
   * The Editor at work on the page: Discard puts its Fields and Lists back
   * as built, and its Limits' counters show here.
   */
  readonly editing: Editing;
}

/** The Editor's controls, rendered into its shadow root. */
export function Editor({ editing }: Props) {
  const { state, lists, limits } = editing;
  // A view that appears after the first render came from the Client's
  // click, so it takes the focus the other view's button had.
  const started = useRef(false);
  useEffect(() => {
    started.current = true;
  }, []);
  const focus = started.current;
  // Kept while the visitor view hides it.
  const preview = useSignal(false);

  return (
    <div class="edity" lang={state.locale}>
      {state.view.value === 'visitor' ? (
        <BackToEditing state={state} focus={focus} />
      ) : (
        <>
          {/* Lets the end of the page scroll clear of the bar. */}
          <div class="spacer" />
          <ListControls state={state} lists={lists} />
          <Bar editing={editing} focus={focus} preview={preview} />
          <Counters limits={limits} t={state.t} />
          <NotApplied state={state} />
          {preview.value && <Preview editing={editing} open={preview} />}
        </>
      )}
    </div>
  );
}

interface ViewProps {
  /** Whether to focus the view's button when it appears. */
  readonly focus: boolean;
}

interface BarProps extends Props, ViewProps {
  /** Whether the phone preview shows. */
  readonly preview: Signal<boolean>;
}

function Bar({ editing, focus, preview }: BarProps) {
  const { session, page, t, draft, view, publishDisabled } = editing.state;
  const count = draft.count.value;
  const visitorView = useFocusOnMount(focus);

  return (
    <div class="bar" role="region" aria-label={t.bar}>
      <span class="client" title={t.signedInAs(session.name)}>
        <span class="avatar" aria-hidden="true">
          {initial(session.name)}
        </span>
        <span class="name">{session.name}</span>
      </span>
      <span class="count" role="status">
        {t.changes(count)}
      </span>
      <button
        type="button"
        class="discard"
        disabled={count === 0}
        onClick={() => {
          const dropped = draft.discard();
          // The page as built, which a Change's `before` may not be (V2).
          showDraft(
            editing,
            dropped.map((change) => asBuilt(change, page?.content)),
          );
        }}
      >
        {t.discard}
      </button>
      {/* TODO(ticket 26): send the Draft, as `publishRequest` in api.ts. */}
      <button type="button" class="publish" disabled={publishDisabled.value}>
        {t.publish}
      </button>
      <span class="tools">
        <PreviewToggle open={preview} t={t} />
        <button
          ref={visitorView}
          type="button"
          class="tool"
          onClick={() => (view.value = 'visitor')}
        >
          <EyeIcon />
          <span class="label">{t.visitorView}</span>
        </button>
      </span>
    </div>
  );
}

/**
 * Tells the Client how many Changes of the Draft kept in the browser no
 * longer apply (P2), above the bar, until they close it.
 */
function NotApplied({ state }: { readonly state: EditorState }) {
  const { notApplied, t } = state;
  if (notApplied.value === 0) return null;
  return (
    <div class="notice" role="status">
      <span>{t.notApplied(notApplied.value)}</span>
      <button type="button" onClick={() => (notApplied.value = 0)}>
        {t.dismiss}
      </button>
    </div>
  );
}

function BackToEditing({
  state,
  focus,
}: ViewProps & { readonly state: EditorState }) {
  const button = useFocusOnMount(focus);
  return (
    <button
      ref={button}
      type="button"
      class="back"
      onClick={() => (state.view.value = 'edit')}
    >
      <PencilIcon />
      <span class="label">{state.t.backToEditing}</span>
    </button>
  );
}

/** A ref for a button that takes the focus when it appears, if `focus`. */
function useFocusOnMount(focus: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, []);
  return ref;
}

/** The first letter of a name, for the Client's badge. */
function initial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}
