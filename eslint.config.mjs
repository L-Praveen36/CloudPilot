import js from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      '**/generated/**',
    ],
  },
  {
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
