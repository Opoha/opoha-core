import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';

import { ContributionRegistry } from './contribution-registry';
import {
  snapshotCoreRootFields,
  syncPluginGraphQLFields,
  type PluginGraphQLFieldSnapshot,
} from './plugin-graphql-merge';

/**
 * Bridges `ContributionRegistry` GraphQL registrations into the live Apollo schema.
 *
 * Nest builds the code-first schema during `GraphQLModule.onModuleInit`, while plugins
 * register during `OnApplicationBootstrap`. This service re-syncs after boot (and after
 * enable/disable) by mutating the Query/Mutation field maps Apollo already holds.
 *
 * Resolves `GraphQLSchemaHost` lazily via `ModuleRef` so `PluginLoaderModule` does not
 * need to import `GraphQLModule` (AppModule owns GraphQL root config).
 */
@Injectable()
export class PluginGraphQLBridgeService {
  private readonly logger = new Logger(PluginGraphQLBridgeService.name);
  private coreFields: PluginGraphQLFieldSnapshot | null = null;

  constructor(
    private readonly contributions: ContributionRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Apply active plugin query/mutation contributions onto the host GraphQL schema.
   * Safe to call repeatedly (enable/disable/boot).
   */
  sync(): void {
    let schemaHost: GraphQLSchemaHost;
    try {
      schemaHost = this.moduleRef.get(GraphQLSchemaHost, { strict: false });
    } catch {
      this.logger.warn('Skipping plugin GraphQL sync — GraphQLSchemaHost is unavailable');
      return;
    }

    let schema;
    try {
      schema = schemaHost.schema;
    } catch {
      this.logger.warn('Skipping plugin GraphQL sync — host schema is not ready yet');
      return;
    }

    if (!this.coreFields) {
      this.coreFields = snapshotCoreRootFields(schema);
    }

    const { applied } = syncPluginGraphQLFields(
      schema,
      this.contributions.listGraphQL(),
      this.coreFields,
    );

    if (applied.length > 0) {
      this.logger.log(`Merged plugin GraphQL fields: ${applied.join(', ')}`);
    }
  }
}
