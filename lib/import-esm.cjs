'use strict';

/**
 * CJS → ESM bridge for loading plugin entry modules.
 *
 * Kept as plain CommonJS (not TypeScript) so:
 * 1. `tsc` cannot rewrite `import()` to `require()` (plugins are `"type": "module"`)
 * 2. Vitest/vite-node does not evaluate this inside a VM without an import callback
 *    (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` from `new Function(... import ...)`).
 *
 * @param {string} specifier Absolute file URL or path acceptable to Node ESM loader
 * @returns {Promise<Record<string, unknown>>}
 */
exports.importEsm = function importEsm(specifier) {
  return import(specifier);
};
