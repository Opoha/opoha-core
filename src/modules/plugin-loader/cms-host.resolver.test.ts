import { describe, expect, it, vi } from 'vitest';

import { ContributionRegistry } from './contribution-registry';
import {
  CMS_CONTENT_PROVIDER_TOKEN,
  CmsHostResolver,
  type CmsContentProvider,
  type CmsPageLike,
} from './cms-host.resolver';

function page(partial: Partial<CmsPageLike> & Pick<CmsPageLike, 'id' | 'slug'>): CmsPageLike {
  const now = new Date('2026-08-03T12:00:00.000Z');
  return {
    title: 'Title',
    status: 'draft',
    seoTitle: null,
    seoDescription: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('CmsHostResolver (H-02)', () => {
  it('createCmsPage / cmsPageBySlug via cms.content provider', () => {
    const pages = new Map<string, CmsPageLike>();
    const provider: CmsContentProvider = {
      createPage(input) {
        const created = page({
          id: 'p1',
          slug: input.slug,
          title: input.title,
          status: input.status ?? 'draft',
        });
        pages.set(created.id, created);
        return created;
      },
      updatePage(id, input) {
        const current = pages.get(id);
        if (!current) throw new Error(`CMS page not found: ${id}`);
        const next = {
          ...current,
          ...input,
          status: input.status ?? current.status,
          publishedAt:
            input.status === 'published' ? new Date() : current.publishedAt,
        };
        pages.set(id, next);
        return next;
      },
      getPage({ id, slug }) {
        if (id) return pages.get(id) ?? null;
        if (slug) {
          return [...pages.values()].find((p) => p.slug === slug) ?? null;
        }
        return null;
      },
      getPublishedBySlug(slug) {
        return (
          [...pages.values()].find(
            (p) => p.slug === slug && p.status === 'published',
          ) ?? null
        );
      },
      listPages(status) {
        return [...pages.values()].filter(
          (p) => status == null || p.status === status,
        );
      },
    };

    const contributions = {
      getProvider: vi.fn((token: string) =>
        token === CMS_CONTENT_PROVIDER_TOKEN ? provider : undefined,
      ),
    } as unknown as ContributionRegistry;

    const resolver = new CmsHostResolver(contributions);
    const created = resolver.createCmsPage({
      slug: 'about',
      title: 'About',
      status: 'draft',
    });
    expect(created.slug).toBe('about');
    expect(resolver.cmsPageBySlug('about')).toBeNull();

    const published = resolver.updateCmsPage(created.id, {
      status: 'published',
    });
    expect(published.status).toBe('published');
    expect(resolver.cmsPageBySlug('about')?.title).toBe('About');
    expect(resolver.cmsPages('published')).toHaveLength(1);
  });

  it('throws when cms.content provider is inactive', () => {
    const contributions = {
      getProvider: vi.fn(() => undefined),
    } as unknown as ContributionRegistry;
    const resolver = new CmsHostResolver(contributions);
    expect(() => resolver.cmsPages()).toThrow(/cms\.content/);
  });
});
