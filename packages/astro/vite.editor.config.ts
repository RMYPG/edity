import { defineConfig } from 'vite';

// Bundles the Editor into one minified ES module, dist/editor.js, which the
// integration copies into each Site's dist/_edity/ under a hashed name.
//
// An app build with a JS entry, not `build.lib`: Vite leaves lib-mode ES
// output unminified.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: {
    outDir: 'dist',
    // dist/ also holds the integration, which tsc has just written there.
    emptyOutDir: false,
    // N5: current Chrome, Edge and Safari, and Firefox 136 or later.
    target: ['chrome120', 'edge120', 'firefox136', 'safari17'],
    modulePreload: false,
    copyPublicDir: false,
    rolldownOptions: {
      input: 'src/editor/main.tsx',
      preserveEntrySignatures: false,
      output: {
        format: 'es',
        entryFileNames: 'editor.js',
        codeSplitting: false,
      },
    },
  },
});
