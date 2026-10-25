import { signal } from '@preact/signals';

/** Whether the Editor has started. */
const state = signal<'loaded'>('loaded');

// TODO(ticket 10): the Editor shell, which first asks the server for the
// session. Until then the Editor only shows that its bundle loaded.
export function Editor() {
  return <div data-state={state}>Edity</div>;
}
