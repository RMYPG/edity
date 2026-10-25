// The Editor bundle's entry point. The inline check imports it, from
// /_edity/editor.<hash>.js, when the browser carries the edity=1 marker cookie.
import { render } from 'preact';
import { Editor } from './Editor.js';

function boot(): void {
  // One unknown tag holds the whole Editor in an open shadow root, so no Site
  // CSS selects it by name and browser tests can still reach inside.
  const host = document.createElement('edity-root');
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  render(<Editor />, shadow);
}

// import() can resolve before the browser has parsed the page.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
