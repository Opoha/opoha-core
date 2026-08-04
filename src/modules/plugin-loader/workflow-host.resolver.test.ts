import { describe, expect, it, vi } from 'vitest';

import { ContributionRegistry } from './contribution-registry';
import {
  WORKFLOW_ENGINE_PROVIDER_TOKEN,
  WorkflowHostResolver,
  type WorkflowDefinitionLike,
  type WorkflowEngineProvider,
  type WorkflowRunLike,
} from './workflow-host.resolver';

describe('WorkflowHostResolver', () => {
  it('lists and upserts definitions via workflow.engine', async () => {
    const defs = new Map<string, WorkflowDefinitionLike>();
    const now = new Date('2026-08-04T00:00:00.000Z');
    const provider: WorkflowEngineProvider = {
      async listDefinitions() {
        return [...defs.values()];
      },
      async upsertDefinition(input) {
        const existing = defs.get(input.code);
        const next: WorkflowDefinitionLike = {
          id: input.id ?? existing?.id ?? 'wf-1',
          code: input.code,
          name: input.name,
          triggerEvent: input.triggerEvent ?? 'OrderPaid',
          steps: input.steps,
          isActive: input.isActive ?? true,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        defs.set(next.code, next);
        return next;
      },
      listRuns() {
        return [] as WorkflowRunLike[];
      },
    };

    const contributions = {
      getProvider: vi.fn((token: string) =>
        token === WORKFLOW_ENGINE_PROVIDER_TOKEN ? provider : undefined,
      ),
    } as unknown as ContributionRegistry;

    const resolver = new WorkflowHostResolver(contributions);
    const saved = await resolver.upsertWorkflowDefinition({
      code: 'ON_PAID',
      name: 'On paid',
      stepsJson: '[{"type":"action","action":"workflow.log"}]',
      triggerEvent: 'OrderPaid',
      isActive: true,
    });
    expect(saved.code).toBe('ON_PAID');
    expect(saved.stepsJson).toContain('workflow.log');

    const listed = await resolver.workflowDefinitions();
    expect(listed).toHaveLength(1);
    const one = await resolver.workflowDefinition('ON_PAID');
    expect(one.name).toBe('On paid');
  });

  it('throws when workflow.engine provider is inactive', async () => {
    const contributions = {
      getProvider: vi.fn(() => undefined),
    } as unknown as ContributionRegistry;
    const resolver = new WorkflowHostResolver(contributions);
    await expect(resolver.workflowDefinitions()).rejects.toThrow(/workflow\.engine/);
  });
});
