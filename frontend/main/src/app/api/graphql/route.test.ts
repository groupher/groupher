import { beforeEach, describe, expect, it, vi } from 'vitest'

const { proxyGraphQLRequest, revalidateTag } = vi.hoisted(() => ({
  proxyGraphQLRequest: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag }))
vi.mock('~/graphql/proxy', () => ({ proxyGraphQLRequest }))

import { POST } from './route'

describe('main GraphQL cache invalidation route', () => {
  beforeEach(() => {
    proxyGraphQLRequest.mockReset()
    revalidateTag.mockReset()
    proxyGraphQLRequest.mockResolvedValue(Response.json({ data: { ok: true } }))
  })

  it('revalidates post caches after restoring a trashed post', async () => {
    await POST(
      new Request('https://groupher.com/api/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query:
            'mutation restoreTrashedPost($community: String!, $id: ID!) { restoreTrashedArticle(community: $community, id: $id, thread: POST) { innerId } }',
          variables: { community: 'home', id: '42' },
        }),
      }),
    )

    expect(revalidateTag).toHaveBeenCalledWith('community[home]-thread[POST]-article[42]', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('community[home]-thread[POST]-articles', 'max')
  })

  it('revalidates document list and tree caches after publishing docs', async () => {
    await POST(
      new Request('https://groupher.com/api/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query:
            'mutation publishDocChanges($community: String!, $input: DocPublishChangesInput) { publishDocChanges(community: $community, input: $input) { done } }',
          variables: {
            community: 'home',
            input: { docChangeIds: ['change:42'], treeChangeIds: ['tree:7'] },
          },
        }),
      }),
    )

    expect(revalidateTag).toHaveBeenCalledWith('community[home]-thread[DOC]-articles', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('community[home]-doc-tree', 'max')
    expect(revalidateTag).toHaveBeenCalledTimes(2)
  })
})
