import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  graphql,
  isListType,
  isNonNullType,
} from 'graphql';
import { describe, expect, it } from 'vitest';

import type { GraphQLContribution } from './contribution-registry';
import {
  resolveOutputType,
  snapshotCoreRootFields,
  syncPluginGraphQLFields,
} from './plugin-graphql-merge';

function buildHostSchema(): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        ping: {
          type: GraphQLString,
          resolve: () => 'pong',
        },
      },
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        noop: {
          type: GraphQLString,
          resolve: () => 'ok',
        },
      },
    }),
  });
}

describe('plugin-graphql-merge', () => {
  it('merges active query contributions into the live schema', async () => {
    const schema = buildHostSchema();
    const core = snapshotCoreRootFields(schema);
    const contributions: GraphQLContribution[] = [
      {
        pluginId: 'my-widget',
        name: 'myWidgetPing',
        kind: 'query',
        active: true,
        descriptor: { resolve: () => 'pong' },
      },
    ];

    const { applied } = syncPluginGraphQLFields(schema, contributions, core);
    expect(applied).toEqual(['query:myWidgetPing']);

    const result = await graphql({ schema, source: '{ myWidgetPing ping }' });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ myWidgetPing: 'pong', ping: 'pong' });
  });

  it('removes inactive contributions on re-sync', async () => {
    const schema = buildHostSchema();
    const core = snapshotCoreRootFields(schema);
    const active: GraphQLContribution[] = [
      {
        pluginId: 'my-widget',
        name: 'myWidgetPing',
        kind: 'query',
        active: true,
        descriptor: { resolve: () => 'pong' },
      },
    ];
    syncPluginGraphQLFields(schema, active, core);

    const inactive = active.map((c) => ({ ...c, active: false }));
    syncPluginGraphQLFields(schema, inactive, core);

    const result = await graphql({ schema, source: '{ myWidgetPing }' });
    expect(result.errors?.[0]?.message).toMatch(/Cannot query field "myWidgetPing"/);
  });

  it('rejects contributions that collide with core root fields', () => {
    const schema = buildHostSchema();
    const core = snapshotCoreRootFields(schema);
    expect(() =>
      syncPluginGraphQLFields(
        schema,
        [
          {
            pluginId: 'bad',
            name: 'ping',
            kind: 'query',
            active: true,
            descriptor: { resolve: () => 'x' },
          },
        ],
        core,
      ),
    ).toThrow(/already exists on the core schema/);
  });

  it('supports mutation contributions and non-null String types', async () => {
    const schema = buildHostSchema();
    const core = snapshotCoreRootFields(schema);
    syncPluginGraphQLFields(
      schema,
      [
        {
          pluginId: 'demo',
          name: 'demoEcho',
          kind: 'mutation',
          active: true,
          descriptor: {
            type: 'String!',
            resolve: () => 'echo',
          },
        },
      ],
      core,
    );

    const result = await graphql({ schema, source: 'mutation { demoEcho }' });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ demoEcho: 'echo' });
  });

  it('resolveOutputType parses list wrappers', () => {
    const schema = buildHostSchema();
    const type = resolveOutputType(schema, '[String!]!');
    expect(isNonNullType(type)).toBe(true);
    expect(isListType(type.ofType)).toBe(true);
  });
});
