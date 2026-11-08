// What a Publish came to, around the bar: how far the Publish it follows has
// got, and what happened when something went wrong (P4, P5).
import { hasEnded, type ShownStage } from './publishing.js';
import type { Editing } from './state.js';

interface Props {
  readonly editing: Editing;
}

/** The stages a Publish goes through when nothing fails, in order. */
const steps: readonly ShownStage[] = ['validating', 'releasing', 'released'];

/** The progress of the Publish the bar follows, just above it. */
export function PublishProgress({ editing }: Props) {
  const { publishing, state } = editing;
  const { t } = state;
  const { stages, progress: name } = t.publishing;
  const progress = publishing.progress.value;
  if (progress === undefined) return null;
  const { stage, version } = progress;
  return (
    <div class="progress" role="status" aria-label={name(version)}>
      <ol class="steps">
        {(stage === 'failed' ? ['failed' as const] : steps).map((step) => (
          <li key={step} aria-current={step === stage ? 'step' : undefined}>
            {stages[step]}
          </li>
        ))}
      </ol>
      {hasEnded(stage) && (
        <button type="button" onClick={() => publishing.closeProgress()}>
          {t.dismiss}
        </button>
      )}
    </div>
  );
}

/**
 * What went wrong: the last Publish's answer, until the Client closes it or
 * changes the Draft, and, while the bar shows them, a failed Release and
 * that the progress can't be read (P5).
 */
export function PublishNotices({ editing }: Props) {
  const { publishing, state } = editing;
  const { t } = state;
  const notice = publishing.notice.value;
  const progress = publishing.progress.value;
  return (
    <>
      {progress?.stage === 'failed' && (
        <div class="notice" role="alert">
          <span>{t.releaseFailed}</span>
        </div>
      )}
      {progress !== undefined && publishing.progressUnknown.value && (
        <div class="notice" role="status">
          <span>{t.publishing.progressUnknown}</span>
        </div>
      )}
      {notice !== undefined && (
        <div class="notice" role="alert">
          <span>{t.publishing.notice(notice)}</span>
          <button type="button" onClick={() => publishing.closeNotice()}>
            {t.dismiss}
          </button>
        </div>
      )}
    </>
  );
}
