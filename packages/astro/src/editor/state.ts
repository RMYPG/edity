import {
  computed,
  signal,
  type ReadonlySignal,
  type Signal,
} from '@preact/signals';
import type { PageMarker } from '../editable.js';
import type { Session } from './api.js';
import { isWellFormed } from './content.js';
import { Draft, type Change } from './draft.js';
import type { Fields } from './fields.js';
import {
  chooseLocale,
  messagesFor,
  type Locale,
  type Messages,
} from './i18n.js';
import type { Lists } from './lists.js';
import type { Limits } from './watch-limits.js';

/**
 * How the Editor shows the page: `edit` with every Editor control, or
 * `visitor` with none of them (P7), only a way back.
 */
export type View = 'edit' | 'visitor';

/** Everything the Editor knows while a Client edits a page. */
export interface EditorState {
  /** The signed-in Client. */
  readonly session: Session;
  /**
   * What the page's `data-edity-page` marker holds: its name, Field
   * definitions and built content. `undefined` on a page with nothing to edit.
   */
  readonly page: PageMarker | undefined;
  /** The Editor's language. */
  readonly locale: Locale;
  /** The Editor's text, in its language. */
  readonly t: Messages;
  /** The page's Draft. */
  readonly draft: Draft;
  /**
   * How many Changes of the Draft kept in the browser were dropped when it
   * was restored, because the page no longer has their Field or List (P2).
   * The Client is told until they close the notice or change the Draft.
   */
  readonly notApplied: Signal<number>;
  /**
   * How the Editor shows the page. In `visitor`, every Editor control hides,
   * including those it adds to the Site's own elements.
   */
  readonly view: Signal<View>;
  /**
   * Whether a Field the Draft changed breaks one of its Limits (L3, L7).
   * `watchLimits` keeps it.
   */
  readonly overLimit: Signal<boolean>;
  /**
   * Whether Publish is disabled: it is while the Draft is empty, while a
   * Change holds a value its Field cannot, such as a blank text, or while a
   * changed Field breaks a Limit.
   */
  readonly publishDisabled: ReadonlySignal<boolean>;
}

/**
 * The Editor at work on a page: its state, and the page's Fields, Lists and
 * Limits, as it edits and checks them.
 */
export interface Editing {
  readonly state: EditorState;
  readonly fields: Fields;
  readonly lists: Lists;
  readonly limits: Limits;
}

export interface EditorStateOptions {
  readonly session: Session;
  readonly page: PageMarker | undefined;
  /** The browser's languages, in order of preference. */
  readonly languages: readonly string[];
  /** The Changes the Draft starts with: the one kept in the browser (P2). */
  readonly changes?: Iterable<Change>;
}

/** The state of an Editor that has just started on a page. */
export function createEditorState({
  session,
  page,
  languages,
  changes,
}: EditorStateOptions): EditorState {
  const locale = chooseLocale(session.locale, languages);
  const draft = new Draft(changes);
  const overLimit = signal(false);
  return {
    session,
    page,
    locale,
    t: messagesFor(locale),
    draft,
    notApplied: signal(0),
    view: signal('edit'),
    overLimit,
    publishDisabled: computed(
      () =>
        draft.count.value === 0 ||
        overLimit.value ||
        (page !== undefined &&
          [...draft.changes.value.values()].some(
            (change) => !isWellFormed(page.fields, change),
          )),
    ),
  };
}
