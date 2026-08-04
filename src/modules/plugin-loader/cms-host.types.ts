import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

import { GraphQLJSONObject } from './graphql-json-object.scalar';

/**
 * Host-side GraphQL shapes for the optional `cms.content` provider
 * (`@opoha/plugin-cms`). Core never imports the plugin — duck-typed only
 *.
 */
@ObjectType('CmsBlock', {
  description: 'CMS content block (plugin-owned)',
})
export class CmsBlockType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  pageId!: string;

  @Field(() => String)
  type!: string;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => GraphQLJSONObject)
  content!: Record<string, unknown>;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('CmsPage', {
  description: 'CMS page (plugin-owned via cms.content ContributionRegistry)',
})
export class CmsPageType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, {
    description: 'draft | published | archived',
  })
  status!: string;

  @Field(() => String, { nullable: true })
  seoTitle!: string | null;

  @Field(() => String, { nullable: true })
  seoDescription!: string | null;

  @Field(() => Date, { nullable: true })
  publishedAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [CmsBlockType])
  blocks!: CmsBlockType[];
}

@InputType({ description: 'Create a CMS page via cms.content provider' })
export class CreateCmsPageInput {
  @Field(() => String)
  slug!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string | null;

  @Field(() => String, { nullable: true })
  seoDescription?: string | null;
}

@InputType({ description: 'Update a CMS page via cms.content provider' })
export class UpdateCmsPageInput {
  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string | null;

  @Field(() => String, { nullable: true })
  seoDescription?: string | null;
}
