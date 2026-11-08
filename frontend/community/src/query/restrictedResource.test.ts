import { beforeEach, expect, it, vi } from 'vitest'

const loadRestrictedResource = vi.hoisted(() => vi.fn())
vi.mock('../server/restrictedResource', () => ({ loadRestrictedResource }))

import { loadResourceWithStatus } from './restrictedResource'

const focus = { type: 'POST' as const, articleInnerId: '12' }
const restricted = {
  type: 'POST',
  status: 'UNAVAILABLE',
  title: 'A visible title',
  url: '/home/post/12',
}

beforeEach(() => vi.resetAllMocks())

it('uses the public detail without probing graph metadata when the body is readable', async () => {
  const resource = { title: 'Published' }
  expect(await loadResourceWithStatus(async () => resource, 'home', focus)).toEqual({
    resource,
    restricted: null,
  })
  expect(loadRestrictedResource).not.toHaveBeenCalled()
})

it('shows restricted metadata when the public detail is unavailable', async () => {
  loadRestrictedResource.mockResolvedValue(restricted)
  expect(await loadResourceWithStatus(async () => null, 'home', focus)).toEqual({
    resource: null,
    restricted,
  })
  expect(loadRestrictedResource).toHaveBeenCalledWith({ data: { community: 'home', focus } })
})

it('uses a stable Article ID locator for an unnumbered draft status page', async () => {
  const articleId = 'f415cb77-93e7-4169-81e1-f60e665e2d87'
  loadRestrictedResource.mockResolvedValue(restricted)
  await loadResourceWithStatus(async () => null, 'home', {
    type: 'BLOG',
    articleInnerId: articleId,
  })
  expect(loadRestrictedResource).toHaveBeenCalledWith({
    data: { community: 'home', focus: { type: 'BLOG', articleId } },
  })
})

it('preserves a detail failure when status lookup cannot verify a restricted node', async () => {
  const failure = new Error('detail failed')
  loadRestrictedResource.mockRejectedValue(new Error('status failed'))
  await expect(
    loadResourceWithStatus(
      async () => {
        throw failure
      },
      'home',
      focus,
    ),
  ).rejects.toBe(failure)
})
