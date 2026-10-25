import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import css from './counters.css?inline';
import type { Messages } from './i18n.js';
import { isOver } from './limits.js';
import type { Limits, LimitMark } from './watch-limits.js';

interface Props {
  readonly limits: Limits;
  readonly t: Messages;
}

/**
 * The Limit counters of the page's Fields, each just below its Field's text
 * (L3, L4, L7): the focused Field's at 80% of a Limit, and every Field's that
 * breaks one.
 */
export function Counters({ limits, t }: Props) {
  const root = useRef<HTMLDivElement | null>(null);
  useSheet(root, css);
  const keyOf = useKeys();
  // Another document's Fields, such as the phone preview's, show their own.
  const marks = limits.marks.value.filter(
    (mark) => mark.box !== undefined && mark.element.ownerDocument === document,
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
    // Below the text, and inside the page's width.
    const width = document.documentElement.clientWidth + window.scrollX;
    const left = Math.max(
      window.scrollX + 4,
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

/** Adopts `css` in the shadow root `ref`'s element is in, while it is. */
function useSheet(ref: { readonly current: Element | null }, css: string) {
  useLayoutEffect(() => {
    const root = ref.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return () => {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
        (each) => each !== sheet,
      );
    };
  }, []);
}
