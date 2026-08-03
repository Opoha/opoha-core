import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

/**
 * Minimal JSON object scalar — avoids adding `graphql-type-json` dependency.
 * Used for CMS block content maps on the host GraphQL surface.
 */
export const GraphQLJSONObject = new GraphQLScalarType({
  name: 'JSONObject',
  description: 'Arbitrary JSON object',
  serialize(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  },
  parseValue(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  },
  parseLiteral(ast: ValueNode): Record<string, unknown> {
    if (ast.kind !== Kind.OBJECT) {
      return {};
    }
    const out: Record<string, unknown> = {};
    for (const field of ast.fields) {
      out[field.name.value] = parseLiteralValue(field.value);
    }
    return out;
  },
});

function parseLiteralValue(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteralValue);
    case Kind.OBJECT: {
      const out: Record<string, unknown> = {};
      for (const field of ast.fields) {
        out[field.name.value] = parseLiteralValue(field.value);
      }
      return out;
    }
    default:
      return null;
  }
}
