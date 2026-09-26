import { THREAD } from '~/const/thread'

import { articleQueries } from './article'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

describe('article detail content query', () => {
  beforeEach(() => {
    browserGraphQLRequest.mockReset()
  })

  it('does not couple content loading to view tracking', async () => {
    browserGraphQLRequest.mockResolvedValue({ post: { innerId: '42' } })

    const options = articleQueries.detail('home', THREAD.POST, '42')
    await options.queryFn?.({} as never)
    await options.queryFn?.({} as never)

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(browserGraphQLRequest.mock.calls[0][1]).toEqual({
      article: { community: 'home', innerId: '42', thread: THREAD.POST },
    })
  })

  it('does not record acceptance when the detail read fails', async () => {
    browserGraphQLRequest.mockRejectedValue(new Error('network'))

    const options = articleQueries.detail('home', THREAD.POST, '42')
    await expect(options.queryFn?.({} as never)).rejects.toThrow('network')
  })
})
