import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { ContributionRegistry } from './contribution-registry';
import { CmsPageType, CreateCmsPageInput, UpdateCmsPageInput } from './cms-host.types';

/**
 * Documented contract for the optional `cms.content` provider
 * (see `@opoha/plugin-cms`). Core never imports the plugin —
 * this shape is a duck-typed agreement resolved by string token only
 * (Phase 4 H-02 host bridge; ADR core-never-imports-plugins).
 */
export type CmsContentProvider = {
  createPage(input: {
    slug: string;
    title: string;
    status?: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }): CmsPageLike;
  updatePage(
    id: string,
    input: {
      slug?: string;
      title?: string;
      status?: string;
      seoTitle?: string | null;
      seoDescription?: string | null;
    },
  ): CmsPageLike;
  getPage(input: { id?: string; slug?: string }): CmsPageLike | null;
  getPublishedBySlug(slug: string): CmsPageLike | null;
  listPages(status?: string): CmsPageLike[];
};

export type CmsPageLike = {
  id: string;
  slug: string;
  title: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  blocks?: Array<{
    id: string;
    pageId: string;
    type: string;
    sortOrder: number;
    content?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export const CMS_CONTENT_PROVIDER_TOKEN = 'cms.content';

function toPageType(page: CmsPageLike): CmsPageType {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    seoTitle: page.seoTitle ?? null,
    seoDescription: page.seoDescription ?? null,
    publishedAt: page.publishedAt ?? null,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    blocks: (page.blocks ?? []).map((b) => ({
      id: b.id,
      pageId: b.pageId,
      type: b.type,
      sortOrder: b.sortOrder,
      content: b.content ?? {},
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
  };
}

/**
 * Host GraphQL bridge for CMS pages via ContributionRegistry `cms.content`.
 * Returns null / throws when the CMS plugin is not installed or not enabled.
 */
@Resolver(() => CmsPageType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CmsHostResolver {
  constructor(private readonly contributions: ContributionRegistry) {}

  private requireProvider(): CmsContentProvider {
    const provider = this.contributions.getProvider<CmsContentProvider>(CMS_CONTENT_PROVIDER_TOKEN);
    if (!provider) {
      throw new BadRequestException(
        'CMS provider "cms.content" is not registered or inactive — enable plugin-cms',
      );
    }
    return provider;
  }

  @Query(() => [CmsPageType], {
    name: 'cmsPages',
    description: 'List CMS pages (requires enabled plugin-cms)',
  })
  @RequirePermission('plugin:read')
  cmsPages(@Args('status', { type: () => String, nullable: true }) status?: string): CmsPageType[] {
    return this.requireProvider().listPages(status).map(toPageType);
  }

  @Query(() => CmsPageType, {
    name: 'cmsPage',
    nullable: true,
    description: 'Get a CMS page by id or slug',
  })
  @RequirePermission('plugin:read')
  cmsPage(
    @Args('id', { type: () => ID, nullable: true }) id?: string,
    @Args('slug', { type: () => String, nullable: true }) slug?: string,
  ): CmsPageType | null {
    if (!id && !slug) {
      throw new BadRequestException('cmsPage requires id or slug');
    }
    const page = this.requireProvider().getPage({ id, slug });
    return page ? toPageType(page) : null;
  }

  @Query(() => CmsPageType, {
    name: 'cmsPageBySlug',
    nullable: true,
    description: 'Public published CMS page by slug',
  })
  @RequirePermission('plugin:read')
  cmsPageBySlug(@Args('slug', { type: () => String }) slug: string): CmsPageType | null {
    const page = this.requireProvider().getPublishedBySlug(slug);
    return page ? toPageType(page) : null;
  }

  @Mutation(() => CmsPageType, {
    name: 'createCmsPage',
    description: 'Create a CMS page via cms.content provider',
  })
  @RequirePermission('plugin:manage')
  createCmsPage(
    @Args('input', { type: () => CreateCmsPageInput }) input: CreateCmsPageInput,
  ): CmsPageType {
    try {
      return toPageType(this.requireProvider().createPage(input));
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'createCmsPage failed');
    }
  }

  @Mutation(() => CmsPageType, {
    name: 'updateCmsPage',
    description: 'Update a CMS page via cms.content provider',
  })
  @RequirePermission('plugin:manage')
  updateCmsPage(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateCmsPageInput }) input: UpdateCmsPageInput,
  ): CmsPageType {
    try {
      return toPageType(this.requireProvider().updatePage(id, input));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'updateCmsPage failed';
      if (message.includes('not found')) {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
  }
}
