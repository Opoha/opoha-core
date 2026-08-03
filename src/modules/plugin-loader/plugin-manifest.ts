import { z } from 'zod';

/** Current plugin contract version accepted by the MVP loader. */
export const PLUGIN_CONTRACT_VERSION = '0.1' as const;

export const pluginManifestSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'plugin id must be kebab-case'),
    version: z.string().min(1),
    contractVersion: z.string().min(1),
    /** Module entry relative to plugin root (dynamically imported by loadDefinitions). */
    entry: z.string().min(1).default('dist/index.js'),
    displayName: z.string().min(1).optional(),
    description: z.string().optional(),
    dependsOn: z.array(z.string().min(1)).default([]),
    engines: z
      .object({
        payment: z.array(z.string()).optional(),
        shipping: z.array(z.string()).optional(),
        tax: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    required: z.boolean().default(false),
  })
  .strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export type DiscoveredPlugin = {
  /** Absolute or resolved package/directory path. */
  rootPath: string;
  /** Source of the manifest (`opoha.plugin.json` or package.json#opoha). */
  manifestSource: 'opoha.plugin.json' | 'package.json';
  manifest: PluginManifest;
};

/**
 * Parse and validate a plugin manifest object.
 * Rejects incompatible contract versions.
 */
export function parsePluginManifest(raw: unknown): PluginManifest {
  const manifest = pluginManifestSchema.parse(raw);
  if (manifest.contractVersion !== PLUGIN_CONTRACT_VERSION) {
    throw new Error(
      `Plugin "${manifest.id}" contractVersion "${manifest.contractVersion}" is incompatible with loader "${PLUGIN_CONTRACT_VERSION}"`,
    );
  }
  return manifest;
}
