import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SearchProvider', {
  description: 'Registered search provider available for indexing and queries',
})
export class SearchProviderType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  displayName!: string;
}

@InputType({ description: 'Product / catalog search query' })
export class SearchProductsInput {
  @Field(() => String)
  query!: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  offset?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Provider code when multiple search providers are active',
  })
  providerCode?: string;
}

@ObjectType('SearchHit', {
  description: 'Single search hit returned by SearchEngine.search',
})
export class SearchHitType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  type!: string;

  @Field(() => Number, { nullable: true })
  score!: number | null;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => String, { nullable: true })
  slug!: string | null;

  @Field(() => String, { nullable: true })
  highlight!: string | null;
}

@ObjectType('SearchProductsResult', {
  description: 'Aggregated product search result from SearchEngine',
})
export class SearchProductsResultType {
  @Field(() => String)
  query!: string;

  @Field(() => [SearchHitType])
  hits!: SearchHitType[];

  @Field(() => Int)
  total!: number;

  @Field(() => String)
  providerCode!: string;

  @Field(() => Int, { nullable: true })
  limit!: number | null;

  @Field(() => Int, { nullable: true })
  offset!: number | null;
}
