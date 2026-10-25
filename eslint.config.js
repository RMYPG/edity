import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/dist/', '**/coverage/', '**/node_modules/', '.claude/'],
  },
  {
    ...eslint.configs.recommended,
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
  },
  ...tseslint.configs.recommended,
];
