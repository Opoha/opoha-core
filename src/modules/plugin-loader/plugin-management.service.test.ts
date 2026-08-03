import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../auth/audit/audit-actions';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { PLUGIN_CONTRACT_VERSION } from './plugin-manifest';
import {
  normalizeConfigJson,
  PluginManagementService,
} from './plugin-management.service';

function createService() {
  const loader = {
    listRecords: vi.fn(),
    getRecord: vi.fn(),
    getState: vi.fn(),
    install: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  };
  const admin = new AdminExtensionRegistry();
  const states = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((input: object) => ({ ...input })),
    save: vi.fn(async (row: object) => row),
  };
  const audit = { append: vi.fn().mockResolvedValue({ id: 'aud' }) };

  const service = new PluginManagementService(
    loader as never,
    admin,
    states as never,
    audit as never,
  );

  return { service, loader, admin, states, audit };
}

function sampleRecord(state: string = 'discovered') {
  return {
    discovered: {
      rootPath: '/tmp/sample',
      manifestSource: 'opoha.plugin.json' as const,
      manifest: {
        id: 'sample',
        version: '1.0.0',
        contractVersion: PLUGIN_CONTRACT_VERSION,
        entry: 'dist/index.js',
        displayName: 'Sample',
        description: 'Demo',
        dependsOn: [] as string[],
        required: false,
      },
    },
    state,
    booted: false,
  };
}

describe('normalizeConfigJson', () => {
  it('accepts object JSON', () => {
    expect(normalizeConfigJson('{"a":1}')).toBe('{"a":1}');
  });

  it('rejects arrays and invalid JSON', () => {
    expect(() => normalizeConfigJson('[1]')).toThrow(BadRequestException);
    expect(() => normalizeConfigJson('not-json')).toThrow(BadRequestException);
  });
});

describe('PluginManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists plugins with durable state', async () => {
    const { service, loader, states, admin } = createService();
    loader.listRecords.mockReturnValue([sampleRecord('installed')]);
    loader.getRecord.mockReturnValue(sampleRecord('installed'));
    states.find.mockResolvedValue([
      { pluginId: 'sample', enabled: true, configJson: '{"x":1}' },
    ]);
    admin.register({
      pluginId: 'sample',
      settings: [
        {
          id: 's1',
          title: 'Settings',
          path: '/plugins/sample/settings',
        },
      ],
    });

    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('sample');
    expect(list[0]?.enabled).toBe(true);
    expect(list[0]?.configJson).toBe('{"x":1}');
    expect(list[0]?.settingsPaths[0]?.path).toBe('/plugins/sample/settings');
  });

  it('installs then enables from discovered and audits', async () => {
    const { service, loader, audit, states } = createService();
    loader.getRecord.mockReturnValue(sampleRecord('discovered'));
    loader.getState
      .mockReturnValueOnce('discovered')
      .mockReturnValueOnce('installed');
    loader.install.mockResolvedValue('installed');
    loader.enable.mockResolvedValue('enabled');
    states.findOne.mockResolvedValue(null);

    // After enable, get() uses getRecord again
    loader.getRecord.mockReturnValue(sampleRecord('enabled'));

    const result = await service.enable('sample', 'user-1');
    expect(loader.install).toHaveBeenCalledWith('sample');
    expect(loader.enable).toHaveBeenCalledWith('sample');
    expect(states.save).toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PLUGIN_ENABLE,
        resourceId: 'sample',
        actorUserId: 'user-1',
      }),
    );
    expect(result.state).toBe('enabled');
  });

  it('disables an enabled plugin', async () => {
    const { service, loader, audit } = createService();
    loader.getRecord.mockReturnValue(sampleRecord('enabled'));
    loader.getState.mockReturnValue('enabled');
    loader.disable.mockResolvedValue('disabled');

    await service.disable('sample', 'user-1');
    expect(loader.disable).toHaveBeenCalledWith('sample');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.PLUGIN_DISABLE }),
    );
  });

  it('updates config JSON', async () => {
    const { service, loader, audit, states } = createService();
    loader.getRecord.mockReturnValue(sampleRecord('enabled'));
    states.findOne
      .mockResolvedValueOnce({
        pluginId: 'sample',
        enabled: true,
        configJson: null,
      })
      .mockResolvedValueOnce({
        pluginId: 'sample',
        enabled: true,
        configJson: '{"instructions":"Pay cash"}',
      });

    const result = await service.updateConfig(
      'sample',
      '{"instructions":"Pay cash"}',
      'user-1',
    );
    expect(result.configJson).toBe('{"instructions":"Pay cash"}');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.PLUGIN_CONFIGURE }),
    );
  });

  it('throws for unknown plugin', async () => {
    const { service, loader } = createService();
    loader.getRecord.mockReturnValue(undefined);
    await expect(service.enable('missing')).rejects.toThrow(NotFoundException);
  });
});
