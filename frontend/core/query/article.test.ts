import { THREAD } from '~/const/thread'

import { articleQueries } from './article'
import { clearArticleViewEventIds } from './viewEvent'
import { clearArticleViewReceipts, readArticleViewReceipt } from './viewReceipt'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

describe('article detail view identity', () => {
  beforeEach(() => {
    browserGraphQLRequest.mockReset()
    clearArticleViewEventIds()
    clearArticleViewReceipts()
  })

  it('reuses the stable event id and records acceptance after a successful read', async () => {
    browserGraphQLRequest.mockResolvedValue({ post: { innerId: '42' } })

    const options = articleQueries.detail('home', THREAD.POST, '42')
    await options.queryFn?.({} as never)
    await options.queryFn?.({} as never)

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    const firstVariables = browserGraphQLRequest.mock.calls[0][1]
    const secondVariables = browserGraphQLRequest.mock.calls[1][1]
    expect(firstVariables.viewEventId).toBe(secondVariables.viewEventId)
    expect(readArticleViewReceipt('home:POST:42')).toMatchObject({
      articleRef: 'home:POST:42',
      viewEventId: firstVariables.viewEventId,
      accepted: true,
    })
  })

  it('does not record acceptance when the detail read fails', async () => {
    browserGraphQLRequest.mockRejectedValue(new Error('network'))

    const options = articleQueries.detail('home', THREAD.POST, '42')
    await expect(options.queryFn?.({} as never)).rejects.toThrow('network')

    expect(readArticleViewReceipt('home:POST:42')).toBeNull()
  })

  it('does not record acceptance for an empty detail result', async () => {
    browserGraphQLRequest.mockResolvedValue({ post: null })

    const options = articleQueries.detail('home', THREAD.POST, '42')
    await options.queryFn?.({} as never)

    expect(readArticleViewReceipt('home:POST:42')).toBeNull()
  })
})
