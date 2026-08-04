import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfig,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql';

import type { GraphQLContribution } from './contribution-registry';

/**
 * Descriptor shape accepted by `registerGraphQL` for root query/mutation fields.
 * Kept intentionally small — complex SDL extensions can land later.
 */
export type PluginGraphQLFieldDescriptor = {
  /** GraphQL field resolver; defaults to returning `null`. */
  resolve?: (...args: unknown[]) => unknown;
  /**
   * Output type SDL fragment (e.g. `String`, `Boolean`, `[String!]!`).
   * Defaults to `String`.
   */
  type?: string;
};

type RootKind = 'query' | 'mutation';

const SCALAR_BY_NAME: Record<string, GraphQLOutputType> = {
  String: GraphQLString,
  Boolean: GraphQLBoolean,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  ID: GraphQLID,
};

/**
 * Parse a small subset of GraphQL output type SDL into a runtime type.
 * Supports named scalars already in the schema (or builtins) and list/non-null wrappers.
 */
export function resolveOutputType(schema: GraphQLSchema, typeSdl: string): GraphQLOutputType {
  const trimmed = typeSdl.trim();
  if (!trimmed) {
    throw new Error('GraphQL contribution type SDL must not be empty');
  }

  if (trimmed.endsWith('!')) {
    return new GraphQLNonNull(resolveOutputType(schema, trimmed.slice(0, -1)));
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return new GraphQLList(resolveOutputType(schema, trimmed.slice(1, -1)));
  }

  const named = schema.getType(trimmed);
  if (named) {
    return named as GraphQLOutputType;
  }

  const builtin = SCALAR_BY_NAME[trimmed];
  if (builtin) {
    return builtin;
  }

  throw new Error(
    `GraphQL contribution type "${trimmed}" is not available on the host schema`,
  );
}

function readDescriptor(contribution: GraphQLContribution): PluginGraphQLFieldDescriptor {
  const raw = contribution.descriptor;
  if (raw == null || typeof raw !== 'object') {
    return {};
  }
  return raw as PluginGraphQLFieldDescriptor;
}

function buildFieldConfig(
  schema: GraphQLSchema,
  contribution: GraphQLContribution,
): GraphQLFieldConfig<unknown, unknown> {
  const descriptor = readDescriptor(contribution);
  const typeSdl = descriptor.type?.trim() || 'String';
  const resolve =
    typeof descriptor.resolve === 'function'
      ? descriptor.resolve
      : () => null;

  return {
    type: resolveOutputType(schema, typeSdl),
    description: `Plugin contribution from "${contribution.pluginId}"`,
    resolve: (...args) => resolve(...args),
  };
}

function rootTypeFor(schema: GraphQLSchema, kind: RootKind) {
  return kind === 'query' ? schema.getQueryType() : schema.getMutationType();
}

/**
 * Snapshot core root field names so later syncs can strip stale plugin fields.
 */
export type PluginGraphQLFieldSnapshot = {
  query: ReadonlySet<string>;
  mutation: ReadonlySet<string>;
};

export function snapshotCoreRootFields(schema: GraphQLSchema): PluginGraphQLFieldSnapshot {
  const query = schema.getQueryType();
  const mutation = schema.getMutationType();
  return {
    query: new Set(query ? Object.keys(query.getFields()) : []),
    mutation: new Set(mutation ? Object.keys(mutation.getFields()) : []),
  };
}

/**
 * Merge active plugin GraphQL query/mutation contributions into the live Nest/Apollo schema.
 *
 * Mutates the existing Query/Mutation field maps in place so Apollo Server (which holds the
 * same `GraphQLSchema` reference) serves the new fields without a restart.
 *
 * `kind: 'type' | 'resolver'` contributions are registry-only until SDL merge lands.
 */
export function syncPluginGraphQLFields(
  schema: GraphQLSchema,
  contributions: readonly GraphQLContribution[],
  coreFields: PluginGraphQLFieldSnapshot,
): { applied: string[] } {
  const applied: string[] = [];

  for (const kind of ['query', 'mutation'] as const) {
    const root = rootTypeFor(schema, kind);
    if (!root) {
      const pending = contributions.filter((c) => c.active && c.kind === kind);
      if (pending.length > 0) {
        throw new Error(
          `Cannot apply plugin ${kind} contributions — host schema has no ${kind === 'query' ? 'Query' : 'Mutation'} type`,
        );
      }
      continue;
    }

    const fields = root.getFields();
    const core = kind === 'query' ? coreFields.query : coreFields.mutation;

    for (const name of Object.keys(fields)) {
      if (!core.has(name)) {
        delete fields[name];
      }
    }

    for (const contribution of contributions) {
      if (!contribution.active || contribution.kind !== kind) {
        continue;
      }
      if (core.has(contribution.name)) {
        throw new Error(
          `GraphQL contribution conflict: ${kind} "${contribution.name}" already exists on the core schema`,
        );
      }
      fields[contribution.name] = {
        name: contribution.name,
        args: [],
        isDeprecated: false,
        deprecationReason: undefined,
        extensions: {},
        astNode: undefined,
        ...buildFieldConfig(schema, contribution),
      } as (typeof fields)[string];
      applied.push(`${kind}:${contribution.name}`);
    }
  }

  return { applied };
}
