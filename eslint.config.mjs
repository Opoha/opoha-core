import coreConfig from '@opoha/eslint-config/core';

/**
 * ADR-0003: core must never import plugins or provider SDKs.
 * Boundary rule now lives in the shared `@opoha/eslint-config/core` preset
 * so every core-shaped package can reuse it.
 *
 * CJS bridge files (lib/*.cjs) need Node `exports`/`module` globals until the
 * published `@opoha/eslint-config` covers package-root .cjs files (not only scripts/).
 */
/** @type {import('eslint').Linter.Config[]} */
export default [
  ...coreConfig,
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        exports: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
];
