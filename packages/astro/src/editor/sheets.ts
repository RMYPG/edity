// Style sheets the Editor adds to a document or to a shadow root: the page's,
// or the phone preview's frame's. Each is made from that document's own
// window, as a frame's sheets must be, and a constructed sheet is one a Site's
// CSP style-src does not apply to.
import { useLayoutEffect, useRef } from 'preact/hooks';

/** Adds a sheet of `css` to `root`. Returns a function that removes it. */
export function adoptSheet(
  root: Document | ShadowRoot,
  css: string,
): () => void {
  const document = 'host' in root ? root.ownerDocument : root;
  const sheet = new document.defaultView!.CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  return () => {
    root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
      (each) => each !== sheet,
    );
  };
}

/**
 * A ref for a component's root element: the shadow root it renders in has a
 * sheet of `css` while the component is there.
 */
export function useSheet<E extends Element>(css: string) {
  const ref = useRef<E | null>(null);
  useLayoutEffect(() => {
    const root = ref.current?.getRootNode();
    const window = root?.ownerDocument?.defaultView;
    if (!window || !(root instanceof window.ShadowRoot)) return;
    return adoptSheet(root, css);
  }, []);
  return ref;
}
