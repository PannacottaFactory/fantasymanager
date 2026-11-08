import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** Rules that keep the simulation pure and deterministic. */
const pureLayerRules = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['**/ui/**', 'react', 'react-dom', 'zustand'], message: 'Engine/data/core must not depend on the UI.' },
      ],
    },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Use the seeded Rng from src/core/rng.ts.' },
    { object: 'Date', property: 'now', message: 'The engine must not read the wall clock.' },
  ],
  'no-restricted-syntax': [
    'error',
    { selector: "NewExpression[callee.name='Date']", message: 'The engine must not read the wall clock.' },
  ],
  'no-restricted-globals': ['error', 'window', 'document', 'localStorage'],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.ts', 'src/data/**/*.ts', 'src/engine/**/*.ts'],
    rules: pureLayerRules,
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
