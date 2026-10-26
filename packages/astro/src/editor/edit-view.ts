// What the Editor adds to the page only in the edit view, and takes away in
// the visitor view (P7), which leaves the page as a visitor sees it.
import { effect, untracked, type ReadonlySignal } from '@preact/signals';
import type { View } from './state.js';

/** Listens to the page's document until the edit view goes. */
export type On = <K extends keyof DocumentEventMap>(
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
  capture?: boolean,
) => void;

/**
 * Calls `start` each time the edit view shows, from now on, and the function
 * it returns each time it goes. `on` listens to the document, and `signal`
 * aborts other listeners, right after that function has run.
 */
export function whileEditing(
  view: ReadonlySignal<View>,
  start: (on: On, signal: AbortSignal) => () => void,
): void {
  effect(() => {
    if (view.value !== 'edit') return;
    const listening = new AbortController();
    const { signal } = listening;
    const on: On = (type, listener, capture = false) =>
      document.addEventListener(type, listener, { signal, capture });
    const stop = untracked(() => start(on, signal));
    return () =>
      untracked(() => {
        stop();
        listening.abort();
      });
  });
}
