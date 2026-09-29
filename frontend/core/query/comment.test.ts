import { describe, expect, it, vi } from 'vitest'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'

import { commentQueries } from './comment'

describe('commentQueries.reconcile', () => {
  it('reconciles a bounded set of Comment refs in one request', async () => {
    browserGraphQLRequest.mockResolvedValue({
      commentReconcileStates: {
        article: { innerId: 7, commentsRevision: 4 },
        entries: [
          { commentInnerId: '1', comment: { innerId: '1', body: 'confirmed' } },
          { commentInnerId: '2', comment: null },
        ],
      },
    })

    const options = commentQueries.reconcile('home', 'POST', '7', ['2', '1', '1'])
    const result = await options.queryFn?.({} as never)

    expect(browserGraphQLRequest).toHaveBeenCalledOnce()
    expect(browserGraphQLRequest.mock.calls[0][1]).toEqual({
      article: { community: 'home', thread: 'POST', innerId: '7' },
      commentInnerIds: ['1', '2'],
    })
    expect(result).toEqual({
      article: { innerId: 7, commentsRevision: 4 },
      comments: { '1': { innerId: '1', body: 'confirmed' }, '2': null },
    })
  })

  it('caps the reconcile contract at 100 unique refs', () => {
    const refs = Array.from({ length: CONFIRMED_COMMENT_RECEIPT_MAX_REFS + 1 }, (_, index) =>
      String(index + 1),
    )
    const options = commentQueries.reconcile('home', 'POST', '7', refs)

    expect(options.queryKey.at(-1)).toHaveLength(CONFIRMED_COMMENT_RECEIPT_MAX_REFS)
  })
})
