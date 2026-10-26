// The List controls (S1, S2, S6), in the Editor's shadow root over the
// Site's own Lists: for the active Item, a handle and buttons to move or
// remove it; for its List, and the Lists in it, a button to add an Item and
// the reason when a bound is reached; and the Undo after a removal.
//
// They show for one Item at a time, so they cover little of the page: the
// Item under the mouse, else the one last focused or tapped.
import { useRef } from 'preact/hooks';
import type { ItemControl, ListControl, Lists, ListsUi } from './lists.js';
import css from './lists.css?inline';
import type { ListMessages } from './lists-i18n.js';
import { useSheet } from './sheets.js';
import type { EditorState } from './state.js';

interface Props {
  readonly state: EditorState;
  readonly lists: Lists;
}

export function ListControls({ state, lists }: Props) {
  const ui = lists.controls;
  const t = state.t.lists;
  const root = useSheet<HTMLDivElement>(css);
  const { lists: shown, item } = ui.shown();
  const dragged = ui.dragged.value;
  const removed = ui.removed.value;
  const { text, id } = ui.announcement.value;

  return (
    <div ref={root} class="lists">
      {shown.map((list) => (
        <ListBar key={list.id} ui={ui} t={t} list={list} />
      ))}
      {item && <ItemBar key={item.id} ui={ui} t={t} item={item} />}
      {dragged && (
        <div class="dragged" style={boxOf(dragged.getBoundingClientRect())} />
      )}
      <div class="live" aria-live="polite">
        <span key={id}>{text}</span>
      </div>
      {removed && (
        <div
          class="undo"
          role="status"
          onPointerEnter={() => ui.keepUndo(true)}
          onPointerLeave={() => ui.keepUndo(false)}
          onFocusIn={() => ui.keepUndo(true)}
          onFocusOut={() => ui.keepUndo(false)}
        >
          <span>{t.removed(removed.name)}</span>
          <button type="button" onClick={() => ui.undo()}>
            {t.undo}
          </button>
        </div>
      )}
    </div>
  );
}

interface BarProps {
  readonly ui: ListsUi;
  readonly t: ListMessages;
}

/** Under a List: add an Item, or why not, and why none can go (S1). */
function ListBar({ ui, t, list }: BarProps & { readonly list: ListControl }) {
  const rect = list.element.getBoundingClientRect();
  const full = list.count >= list.max;
  const reason = `edity-list-${list.id}`;
  return (
    <div
      class="list-bar"
      style={{
        top: px(rect.bottom + scrollY + 4),
        left: px(rect.left + scrollX),
      }}
    >
      <button
        type="button"
        class="add"
        aria-label={t.addTo(list.within)}
        aria-describedby={full ? reason : undefined}
        disabled={full}
        onClick={() => ui.add(list.element)}
      >
        <PlusIcon />
        <span>{t.add}</span>
      </button>
      {full && (
        <span class="reason" id={reason}>
          {t.atMost(list.max)}
        </span>
      )}
      {list.count <= list.min && list.min > 0 && (
        <span class="reason" id={`${reason}-min`}>
          {t.atLeast(list.min)}
        </span>
      )}
    </div>
  );
}

/** Above an Item's end: its handle, and buttons to move or remove it (S2). */
function ItemBar({ ui, t, item }: BarProps & { readonly item: ItemControl }) {
  const handle = useRef<HTMLButtonElement | null>(null);
  const rect = item.element.getBoundingClientRect();
  const { name, element, index, count, across } = item;

  /** Moves the Item, keeping the focus on a button that still works. */
  const move = (step: -1 | 1) => (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    ui.move(element, step);
    requestAnimationFrame(() => {
      if (button.disabled) handle.current?.focus();
    });
  };

  return (
    <div
      class="item-bar"
      style={{ top: px(rect.top + scrollY), left: px(rect.right + scrollX) }}
    >
      <button
        ref={handle}
        type="button"
        class="handle"
        aria-label={t.drag(name)}
        title={t.drag(name)}
        onPointerDown={(event) => ui.grab(element, event)}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          const step =
            event.key === 'ArrowUp' || event.key === 'ArrowLeft'
              ? -1
              : event.key === 'ArrowDown' || event.key === 'ArrowRight'
                ? 1
                : 0;
          if (step === 0) return;
          event.preventDefault();
          ui.move(element, step);
        }}
      >
        <GripIcon />
      </button>
      <button
        type="button"
        aria-label={t.moveUp(name)}
        title={t.moveUp(name)}
        disabled={index === 0}
        onClick={move(-1)}
      >
        <ArrowIcon direction={across ? 'left' : 'up'} />
      </button>
      <button
        type="button"
        aria-label={t.moveDown(name)}
        title={t.moveDown(name)}
        disabled={index === count - 1}
        onClick={move(1)}
      >
        <ArrowIcon direction={across ? 'right' : 'down'} />
      </button>
      <button
        type="button"
        aria-label={t.remove(name)}
        title={t.remove(name)}
        disabled={!item.canRemove}
        onClick={() => ui.remove(element)}
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

/** Where a box on the page goes, as the controls' root is at its origin. */
function boxOf(rect: DOMRect) {
  return {
    top: px(rect.top + scrollY),
    left: px(rect.left + scrollX),
    width: px(rect.width),
    height: px(rect.height),
  };
}

function px(value: number): string {
  return `${Math.round(value)}px`;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" class="grip">
      {[6, 12, 18].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.4" />
          <circle cx="15" cy={y} r="1.4" />
        </g>
      ))}
    </svg>
  );
}

const arrows = {
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  left: 'M19 12H5M11 6l-6 6 6 6',
  right: 'M5 12h14M13 6l6 6-6 6',
};

function ArrowIcon({ direction }: { direction: keyof typeof arrows }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={arrows[direction]} />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
    </svg>
  );
}
