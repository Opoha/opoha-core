import { Query, Resolver } from '@nestjs/graphql';

/**
 * Minimal code-first GraphQL shell so Apollo can boot an empty product schema.
 * Domain types land with later modules.
 */
@Resolver()
export class ShellResolver {
  @Query(() => String, {
    name: 'ping',
    description: 'Scaffold ping — proves GraphQL introspection is available',
  })
  ping(): string {
    return 'pong';
  }
}
