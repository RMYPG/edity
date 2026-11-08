import type { Editing } from './state.js';
import type { ShownStage } from './publishing.js';

/** The stages a Publish goes through when nothing fails, in order. */
const steps: readonly ShownStage[] = ['validating', 'releasing', 'released'];

/** The progress of the Publish the bar follows, above it (P4). */
export function PublishProgress({ editing }: { readonly editing: Editing }) {
  const { publishing, state } = editing;
  const { stages, progress: name } = state.t.publishing;
  const progress = publishing.progress.value;
  if (progress === undefined) return null;
  return (
    <div class="progress" role="status" aria-label={name(progress.version)}>
      <ol class="steps">
        {(progress.stage === 'failed' ? ['failed' as const] : steps).map(
          (step) => (
            <li
              key={step}
              aria-current={step === progress.stage ? 'step' : undefined}
            >
              {stages[step]}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
