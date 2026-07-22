import { describe, expect, it } from 'vitest'

import { pageIdsFromTabs, pageMetaFromSourceTree, totalPageSize } from './sourceTreeSelection'

describe('docs import source tree selection', () => {
  it('derives navigation and draft metadata for page selection defaults', () => {
    const metadata = pageMetaFromSourceTree([
      {
        children: [
          { kind: 'page', sizeBytes: 1536, sourceId: 'docs/listed.md' },
          {
            draft: true,
            kind: 'page',
            navigationStatus: 'unlisted',
            sourceId: 'docs/draft.md',
          },
        ],
        kind: 'scope',
        sourceId: 'docs',
      },
    ])

    expect(metadata.get('docs/listed.md')).toEqual({
      draft: false,
      navigationStatus: 'in_navigation',
      sizeBytes: 1536,
    })
    expect(metadata.get('docs/draft.md')).toEqual({
      draft: true,
      navigationStatus: 'unlisted',
      sizeBytes: undefined,
    })
  })

  it('collects unique page ids without including links', () => {
    expect(
      pageIdsFromTabs([
        {
          groups: [
            {
              children: [
                { sourceId: 'docs/a.md', title: 'A', type: 'page' },
                { sourceId: 'external', title: 'External', type: 'link' },
                { sourceId: 'docs/a.md', title: 'A again', type: 'page' },
              ],
              sourceId: 'guides',
              title: 'Guides',
            },
          ],
          sourceId: 'docs',
          title: 'Docs',
        },
      ]),
    ).toEqual(['docs/a.md'])
  })

  it('totals directory file sizes only when every page has size metadata', () => {
    const complete = new Map([
      ['docs/a.md', { draft: false, navigationStatus: 'in_navigation' as const, sizeBytes: 1024 }],
      ['docs/b.md', { draft: false, navigationStatus: 'in_navigation' as const, sizeBytes: 512 }],
    ])

    expect(totalPageSize(['docs/a.md', 'docs/b.md'], complete)).toBe(1536)
    expect(totalPageSize([], complete)).toBeNull()
    expect(totalPageSize(['docs/a.md', 'docs/missing.md'], complete)).toBeNull()
  })
})
