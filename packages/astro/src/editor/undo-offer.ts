// The short Undo after removing an Item (S6): offered for a few seconds, and
// kept while the Client points at it or focuses it.
import { signal, type ReadonlySignal } from '@preact/signals';

/** How long an Undo stays, in ms. */
const undoFor = 6000;

/** What Undo can put back, while it is offered. */
export interface UndoOffer<T> {
  /** What Undo would put back, while it is offered. */
  readonly offered: ReadonlySignal<T | undefined>;
  /** Offers to put `removed` back, in place of anything offered before. */
  offer(removed: T): void;
  /** Keeps the offer while `keep`, and lets it go a while after. */
  keep(keep: boolean): void;
  /** Withdraws the offer. */
  dismiss(): void;
  /** Withdraws the offer and returns what it was, to put it back. */
  take(): T | undefined;
}

export function undoOffer<T>(): UndoOffer<T> {
  const offered = signal<T | undefined>(undefined);
  let timer = 0;

  function keep(keep: boolean): void {
    clearTimeout(timer);
    if (!keep && offered.peek() !== undefined) {
      timer = window.setTimeout(dismiss, undoFor);
    }
  }

  function dismiss(): void {
    clearTimeout(timer);
    offered.value = undefined;
  }

  return {
    offered,
    offer(removed) {
      offered.value = removed;
      keep(false);
    },
    keep,
    dismiss,
    take() {
      const removed = offered.peek();
      dismiss();
      return removed;
    },
  };
}
