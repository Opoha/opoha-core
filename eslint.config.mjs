import coreConfig from '@opoha/eslint-config/core';

/**
 * ADR-0003: core must never import plugins or provider SDKs.
 * Boundary rule now lives in the shared `@opoha/eslint-config/core` preset
 * so every core-shaped package can reuse it.
 */
/** @type {import('eslint').Linter.Config[]} */
export default [...coreConfig];
