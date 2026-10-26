import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import css from './counters.css?inline';
import type { Messages } from './i18n.js';
import { isOver } from './limits.js';
import { useSheet } from './sheets.js';
import type { Limits, LimitMark } from './watch-limits.js';

interface Props {
  readonly limits: Limits;
  readonly t: Messages;
  /**
   * The document whose Fields' counters these are, which they are rendered
   * into: the page's, or the phone preview's frame's.
   */
  readonly of?: Document;
}

/**
 * The Limit counters of the page's Fields, each just below its Field's text
 * (L3, L4, L7): the focused Field's at 80% of a Limit, and every Field's that
 * breaks one.
 */
export function Counters({ limits, t, of = document }: Props) {
  const root = useSheet<HTMLDivElement>(css);
  const keyOf = useKeys();
  // Another document's Fields, such as the phone preview's, show their own.
  const marks = limits.marks.value.filter(
    (mark) => mark.box !== undefined && mark.element.ownerDocument === of,
  );
  return (
    <div ref={root} class="counters">
      {marks.map((mark) => (
        <Counter key={keyOf(mark.element)} mark={mark} t={t} />
      ))}
    </div>
  );
}

function Counter({ mark, t }: { mark: LimitMark; t: Messages }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { box } = mark;
  useLayoutEffect(() => {
    const counter = ref.current;
    if (counter === null || box === undefined) return;
    const { documentElement, defaultView } = counter.ownerDocument;
    const scrollX = defaultView?.scrollX ?? 0;
    // Below the text, and inside the page's width.
    const width = documentElement.clientWidth + scrollX;
    const left = Math.max(
      scrollX + 4,
      Math.min(box.left, width - counter.offsetWidth - 4),
    );
    counter.style.top = `${box.bottom + 6}px`;
    counter.style.left = `${left}px`;
  });
  return (
    <div ref={ref} class={`counter ${mark.standing}`}>
      {mark.counts.map((count, at) => {
        const text = t.limit(count);
        return (
          <span key={at}>
            {mark.standing === 'warning' && isOver(count)
              ? t.published(text)
              : text}
          </span>
        );
      })}
    </div>
  );
}

/** A key for each Field element: one path can show in several (E7). */
function useKeys(): (element: Element) => number {
  const [keys] = useState(() => ({
    of: new WeakMap<Element, number>(),
    last: 0,
  }));
  return (element) => {
    let key = keys.of.get(element);
    if (key === undefined) {
      key = ++keys.last;
      keys.of.set(element, key);
    }
    return key;
  };
}
