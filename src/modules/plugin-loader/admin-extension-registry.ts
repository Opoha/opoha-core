import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const navItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    path: z.string().min(1),
    icon: z.string().optional(),
    order: z.number().int().optional(),
    permission: z.string().optional(),
  })
  .strict();

const pageContributionSchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    title: z.string().min(1),
    permission: z.string().optional(),
  })
  .strict();

const widgetContributionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    permission: z.string().optional(),
  })
  .strict();

const settingsContributionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    path: z.string().min(1),
    permission: z.string().optional(),
  })
  .strict();

const tabContributionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    permission: z.string().optional(),
  })
  .strict();

export const adminContributionSchema = z
  .object({
    pluginId: z.string().min(1),
    navigation: z.array(navItemSchema).default([]),
    pages: z.array(pageContributionSchema).default([]),
    widgets: z.array(widgetContributionSchema).default([]),
    settings: z.array(settingsContributionSchema).default([]),
    tabs: z
      .object({
        product: z.array(tabContributionSchema).optional(),
        order: z.array(tabContributionSchema).optional(),
        customer: z.array(tabContributionSchema).optional(),
      })
      .strict()
      .optional(),
    permissions: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type AdminContribution = z.infer<typeof adminContributionSchema>;

export type AdminExtensionManifest = {
  plugins: AdminContribution[];
};

/**
 * Server-side admin extension registration (ADR-0006 / D-06).
 * Only enabled plugins are included in the merged manifest.
 */
@Injectable()
export class AdminExtensionRegistry {
  private readonly byPlugin = new Map<
    string,
    { contribution: AdminContribution; active: boolean }
  >();

  register(raw: unknown, active = true): AdminContribution {
    const contribution = adminContributionSchema.parse(raw);
    this.byPlugin.set(contribution.pluginId, { contribution, active });
    return contribution;
  }

  setActive(pluginId: string, active: boolean): void {
    const entry = this.byPlugin.get(pluginId);
    if (entry) {
      entry.active = active;
    }
  }

  remove(pluginId: string): void {
    this.byPlugin.delete(pluginId);
  }

  getContribution(pluginId: string): AdminContribution | undefined {
    return this.byPlugin.get(pluginId)?.contribution;
  }

  getManifest(activeOnly = true): AdminExtensionManifest {
    const plugins: AdminContribution[] = [];
    for (const entry of this.byPlugin.values()) {
      if (!activeOnly || entry.active) {
        plugins.push(entry.contribution);
      }
    }
    plugins.sort((a, b) => a.pluginId.localeCompare(b.pluginId));
    return { plugins };
  }
}
