import { describe, expect, it } from 'vitest'

import { resolveCommunityPreviewMask } from './community-preview'

describe('community preview mask', () => {
  it.each([
    ['/home/post', '/home/post/123', '/home/post/previewer/123'],
    ['/home/changelog', '/home/changelog/123', '/home/changelog/previewer/123'],
    ['/home/kanban', '/home/post/123', '/home/kanban/previewer/post/123'],
  ])('resolves %s to a private preview route', (currentPathname, href, to) => {
    expect(resolveCommunityPreviewMask({ currentPathname, href, previewId: 123 })).toEqual({
      to,
      visibleHref: href,
    })
  })

  it('rejects unsupported contexts and mismatched targets', () => {
    expect(
      resolveCommunityPreviewMask({
        currentPathname: '/home/post/456',
        href: '/home/post/123',
        previewId: 123,
      }),
    ).toBeNull()
    expect(
      resolveCommunityPreviewMask({
        currentPathname: '/home/post',
        href: '/other/post/123',
        previewId: 123,
      }),
    ).toBeNull()
    expect(
      resolveCommunityPreviewMask({
        currentPathname: '/home/kanban',
        href: '/home/changelog/123?post=/home/post/123',
        previewId: 123,
      }),
    ).toBeNull()
  })
})
