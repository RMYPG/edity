// Publishing the Draft (P3 to P5, P8): sending it to the server, and
// following the Release it becomes.
//
// A Publish's commit reaches the page only once its Release is built and
// deployed, so until then the page shows what was published on top of what
// it was built from. What was published is the Field's value for everything
// that reads the page's content: the next Change's `before` (P8), Discard and
// the phone preview. A Client who reloads gets all of this back (P4).
import {
  batch,
  effect,
  signal,
  untracked,
  type ReadonlySignal,
} from '@preact/signals';
import {
  getPublishStatus,
  loginUrl,
  publish,
  publishRequest,
  type PublishStatus,
} from './api.js';
import type { PageMarker } from '../editable.js';
import { fitsDraft, setValueAt } from './content.js';
import type { Change } from './draft.js';
import type {
  LoginReturnStore,
  ProgressStore,
  PublishedStore,
} from './draft-store.js';
import type { PublishNotice } from './publish-i18n.js';
import { stillToBuild, type CommittedChange } from './published.js';
import { rejectedMarks } from './rejected.js';
import { showDraft } from './show-draft.js';
import type { Editing } from './state.js';

/**
 * How often to ask for a Publish's progress, in ms: the server answers the
 * same to anything sooner.
 */
const pollEvery = 5000;

/**
 * How often to ask about a Publish that failed, in ms. A newer Release that
 * contains its commit makes it `released`, so it is not over, but that takes
 * someone doing something.
 */
const pollFailedEvery = 30_000;

/** A stage as the Editor shows it. */
export type ShownStage = 'validating' | 'releasing' | 'released' | 'failed';

/** The Publish the Editor follows, and how far it has got. */
export interface Progress {
  readonly sha: string;
  readonly version: string;
  /** The page it published: any page of the Site can follow it. */
  readonly page: string;
  readonly stage: ShownStage;
}

/** The Editor's Publishes. */
export interface Publishing {
  /** The Publish the bar follows, if any. */
  readonly progress: ReadonlySignal<Progress | undefined>;
  /** Whether the Publish's progress could not be read lately. */
  readonly progressUnknown: ReadonlySignal<boolean>;
  /**
   * What the Client has to be told about their last Publish, until they
   * close it or change the Draft (P5).
   */
  readonly notice: ReadonlySignal<PublishNotice | undefined>;
  /**
   * The Changes published that the page as built may not hold yet, in the
   * order they were published.
   */
  published(): readonly Change[];
  /** Sends the Draft to the server. */
  publish(): Promise<void>;
  /** Stops showing a Publish that has reached its end. */
  closeProgress(): void;
  /** Stops showing the notice. */
  closeNotice(): void;
}

/** Where the Editor keeps its Publishes in the browser. */
export interface PublishingStores {
  /** Where each page's published Changes are kept, by the page's name. */
  published(page: string): PublishedStore;
  readonly progress: ProgressStore;
  readonly loginReturn: LoginReturnStore;
}

/**
 * Starts publishing the page's Draft, for as long as the Editor runs, and
 * picks up what an earlier page load left: the Publish it followed, the
 * Changes published that the page was not built with yet, and a Client just
 * back from logging in.
 */
export function startPublishing(
  { state, fields, lists }: Pick<Editing, 'state' | 'fields' | 'lists'>,
  stores: PublishingStores,
): Publishing {
  const { draft, page, view } = state;
  const progress = signal(stores.progress.load());
  const progressUnknown = signal(false);
  const notice = signal<PublishNotice | undefined>(
    stores.loginReturn.take() ? { kind: 'signed-back-in' } : undefined,
  );
  const rejected = rejectedMarks(document);
  const pageStore = page && stores.published(page.page);
  /** The Changes published that the page as built may not hold yet. */
  let published: readonly CommittedChange[] = [];
  /** The Draft a notice is about: it goes once the Draft changes. */
  let noticed = draft.changes.peek();
  let timer = 0;
  /** How many times in a row the progress could not be read. */
  let unreadable = 0;

  /** The value at `path` for the Client now: the Draft's, or the page's. */
  const valueNow = (path: string) => draft.valueAt(path, page?.content);

  /** Makes `changes`, already on the page, what it holds as published. */
  function settle(changes: readonly Change[]): void {
    if (page === undefined) return;
    for (const { path, after } of changes) {
      setValueAt(page.content, path, structuredClone(after));
    }
    lists.settle(changes.map(({ path }) => path));
  }

  /**
   * Takes `changes`, which the server now holds, out of the Draft for good.
   * `sha` is the commit they went in, when the server said.
   */
  function keepPublished(changes: readonly Change[], sha?: string): void {
    // The content first: the phone preview puts each Change that leaves the
    // Draft back as the content has it.
    batch(() => {
      settle(changes);
      for (const { path } of changes) draft.remove(path);
    });
    published = [...published, ...changes.map((each) => ({ ...each, sha }))];
    pageStore?.keep(published);
  }

  /**
   * Forgets the Changes the Publish `lost` made, which are kept for the page
   * it published, whichever page the Client is on now. Those of any other
   * Publish stay.
   */
  function forgetPublished(lost: Progress): void {
    const others = ({ sha }: CommittedChange) => sha !== lost.sha;
    published = published.filter(others);
    const store = stores.published(lost.page);
    store.keep(store.load().filter(others));
  }

  /** Tells the Client `next`, until they close it or change the Draft. */
  function tell(next: PublishNotice): void {
    notice.value = next;
    noticed = draft.changes.peek();
  }

  /** Marks the Conflicts at `paths`, and says they stay in the Draft. */
  function conflicted(paths: readonly string[], merged: boolean): void {
    rejected.mark(paths, valueNow);
    tell({ kind: 'conflicts', count: paths.length, published: merged });
  }

  function show(next: Progress | undefined): void {
    progress.value = next;
    stores.progress.keep(next);
  }

  function follow(delay: number): void {
    clearTimeout(timer);
    timer = window.setTimeout(() => void check(), delay);
  }

  async function check(): Promise<void> {
    const followed = progress.peek();
    if (followed === undefined) return;
    const result = await getPublishStatus(followed.sha);
    // A newer Publish took its place, or it was closed, while it was asked.
    if (progress.peek()?.sha !== followed.sha) return;
    switch (result.status) {
      case 'known': {
        unreadable = 0;
        progressUnknown.value = false;
        const stage = shownStage(result.stage);
        show({ ...followed, stage });
        if (stage !== 'released') {
          follow(stage === 'failed' ? pollFailedEvery : pollEvery);
        }
        return;
      }
      case 'not-found':
        // Not a Publish on the Site, perhaps no longer: there is nothing to
        // follow, and what it published is not on its way to its page, so
        // that page's next load shows it without that.
        forgetPublished(followed);
        show(undefined);
        tell({ kind: 'lost' });
        return;
      case 'signed-out':
        // Back on the next page load, once logged in again.
        progressUnknown.value = true;
        return;
      case 'unknown':
        // A moment's 503 is not worth a word.
        unreadable++;
        if (unreadable >= 2) progressUnknown.value = true;
        follow(Math.max(pollEvery, (result.retryAfter ?? 0) * 1000));
        return;
    }
  }

  /** Sends the Client to log in, to come back to this page (A3). */
  function sendToLogin(): void {
    stores.loginReturn.mark();
    location.assign(loginUrl(location.pathname));
  }

  async function send(page: PageMarker): Promise<void> {
    const changes = [...draft.changes.peek().values()];
    const merged = (conflicts: readonly string[]) =>
      changes.filter(({ path }) => !conflicts.includes(path));
    const result = await publish(publishRequest(page.page, changes));
    switch (result.status) {
      case 'published':
        keepPublished(merged(result.conflicts), result.sha);
        if (result.conflicts.length > 0) conflicted(result.conflicts, true);
        unreadable = 0;
        progressUnknown.value = false;
        show({
          sha: result.sha,
          version: result.version,
          page: page.page,
          stage: 'validating',
        });
        follow(pollEvery);
        return;
      case 'conflicts':
        // A Change that is not a Conflict was already published.
        keepPublished(merged(result.conflicts));
        conflicted(result.conflicts, false);
        return;
      case 'violations':
        tell({
          kind: 'violations',
          count: result.violations.length,
          marked: rejected.mark(result.violations, valueNow),
        });
        return;
      case 'signed-out':
        sendToLogin();
        return;
      case 'failed':
        tell(result.problem);
        return;
    }
  }

  // What an earlier page load left: the Changes it published, which go on the
  // page before the Draft does, and the Publish it followed.
  if (page !== undefined) {
    const kept = pageStore?.load() ?? [];
    published = stillToBuild(
      page.content,
      kept.filter((change) => fitsDraft(page.fields, change)),
    );
    if (published.length !== kept.length) pageStore?.keep(published);
    showDraft({ fields, lists }, published);
    settle(published);
  }
  if (progress.peek() !== undefined) follow(0);

  // A mark is about the value it is on, and a notice about the whole Draft.
  effect(() => {
    const changes = draft.changes.value;
    untracked(() => {
      rejected.update(valueNow);
      if (changes !== noticed) notice.value = undefined;
    });
  });

  return {
    progress,
    progressUnknown,
    notice,
    published: () => published,
    async publish() {
      if (page === undefined || state.publishDisabled.peek()) return;
      // Nothing on the page can change until the server has answered, and a
      // Field being edited is left, which records it.
      view.value = 'publishing';
      notice.value = undefined;
      rejected.clear();
      try {
        await send(page);
      } finally {
        view.value = 'edit';
      }
    },
    closeProgress() {
      clearTimeout(timer);
      show(undefined);
    },
    closeNotice() {
      notice.value = undefined;
    },
  };
}

/** Whether the Client can close the progress of a Publish at `stage`. */
export function hasEnded(stage: ShownStage): boolean {
  return stage === 'released' || stage === 'failed';
}

/** How a stage shows until ticket 33 adds Deploying and Live. */
function shownStage(stage: PublishStatus['stage']): ShownStage {
  switch (stage) {
    case 'validating':
    case 'releasing':
    case 'failed':
      return stage;
    case 'released':
    case 'deploying':
    case 'live':
      return 'released';
  }
}
