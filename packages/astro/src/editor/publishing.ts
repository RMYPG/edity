// Publishing the Draft (P3 to P5, P8): sending it to the server, and
// following the Release it becomes.
//
// A Publish's commit reaches the page only once its Release is built and
// deployed, so until then the page shows what was published on top of what
// it was built from. What was published is the Field's value for everything
// that reads the page's content: the next Change's `before` (P8), Discard and
// the phone preview. A Client who reloads gets all of this back (P4).
import { batch, signal, type ReadonlySignal } from '@preact/signals';
import {
  getPublishStatus,
  publish,
  publishRequest,
  type PublishStatus,
} from './api.js';
import { fitsDraft, setValueAt } from './content.js';
import type { Change } from './draft.js';
import type { DraftStore, ProgressStore } from './draft-store.js';
import { stillToBuild } from './published.js';
import { showDraft } from './show-draft.js';
import type { Editing } from './state.js';

/**
 * How often to ask for a Publish's progress, in ms: the server answers the
 * same to anything sooner.
 */
const pollEvery = 5000;

/** A stage as the Editor shows it. */
export type ShownStage = 'validating' | 'releasing' | 'released' | 'failed';

/** The Publish the Editor follows, and how far it has got. */
export interface Progress {
  readonly sha: string;
  readonly version: string;
  readonly stage: ShownStage;
}

/** The Editor's Publishes. */
export interface Publishing {
  /** The Publish the bar follows, if any. */
  readonly progress: ReadonlySignal<Progress | undefined>;
  /**
   * The Changes published that the page as built may not hold yet, in the
   * order they were published.
   */
  published(): readonly Change[];
  /** Sends the Draft to the server. */
  publish(): Promise<void>;
}

/** Where the Editor keeps its Publishes in the browser. */
export interface PublishingStores {
  /** The page's published Changes, on a page with something to edit. */
  readonly published: DraftStore | undefined;
  readonly progress: ProgressStore;
}

/**
 * Starts publishing the page's Draft, for as long as the Editor runs, and
 * picks up what an earlier page load left: the Publish it followed, and the
 * Changes published that the page was not built with yet.
 */
export function startPublishing(
  { state, fields, lists }: Pick<Editing, 'state' | 'fields' | 'lists'>,
  stores: PublishingStores,
): Publishing {
  const { draft, page, view } = state;
  const progress = signal(stores.progress.load());
  let published: readonly Change[] = [];
  let timer = 0;

  /** Makes `changes`, already on the page, what it holds as published. */
  function settle(changes: readonly Change[]): void {
    if (page === undefined) return;
    for (const { path, after } of changes) {
      setValueAt(page.content, path, structuredClone(after));
    }
    lists.settle(changes.map(({ path }) => path));
  }

  if (page !== undefined) {
    const kept = stores.published?.load() ?? [];
    published = stillToBuild(
      page.content,
      kept.filter((change) => fitsDraft(page.fields, change)),
    );
    if (published.length !== kept.length) stores.published?.keep(published);
    showDraft({ fields, lists }, published);
    settle(published);
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
    // A newer Publish took its place while it was asked.
    if (progress.peek()?.sha !== followed.sha) return;
    if (result.status === 'known') {
      const stage = shownStage(result.stage);
      show({ ...followed, stage });
      if (stage === 'released' || stage === 'failed') return;
    }
    follow(pollEvery);
  }

  if (progress.peek() !== undefined) follow(0);

  return {
    progress,
    published: () => published,
    async publish() {
      if (page === undefined || state.publishDisabled.peek()) return;
      // Nothing on the page can change until the server has answered, and a
      // Field being edited is left, which records it.
      view.value = 'publishing';
      const changes = [...draft.changes.peek().values()];
      const result = await publish(publishRequest(page.page, changes));
      if (result.status === 'published') {
        // The content first: the phone preview puts each Change that leaves
        // the Draft back as the content has it.
        batch(() => {
          settle(changes);
          for (const { path } of changes) draft.remove(path);
        });
        published = [...published, ...changes];
        stores.published?.keep(published);
        show({
          sha: result.sha,
          version: result.version,
          stage: 'validating',
        });
        follow(pollEvery);
      }
      view.value = 'edit';
    },
  };
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
