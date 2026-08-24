import { THREAD } from '~/const/thread'

import { viewerQueries } from './viewer'

const { browserQuery } = vi.hoisted(() => ({ browserQuery: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserQuery }))

describe('viewer query factories', () => {
  beforeEach(() => browserQuery.mockReset())

  it('loads Doc viewer state from the Doc operation', async () => {
    const state = { innerId: '42', viewerHasCollected: false, viewerHasUpvoted: true }
    browserQuery.mockResolvedValue({ doc: state })
    const options = viewerQueries.articleState('alice', 'home', THREAD.DOC, '42')

    await expect(options.queryFn?.({} as never)).resolves.toEqual(state)
    expect(browserQuery).toHaveBeenCalledOnce()
  })

  it('owns comment summary and viewer participation state in a viewer-scoped query', async () => {
    const summary = {
      totalCount: 3,
      isViewerJoined: true,
      participantsCount: 1,
      participants: [{ login: 'alice' }],
    }
    browserQuery.mockResolvedValue({ commentsState: summary })
    const options = viewerQueries.commentSummary('alice', 'home', THREAD.POST, '42')

    await expect(options.queryFn?.({} as never)).resolves.toEqual(summary)
    expect(options.queryKey).toEqual(['viewer', 'alice', 'comment-summary', 'home:POST:42'])
  })
})
