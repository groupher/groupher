import { THREAD } from '~/const/thread'

import { articleQueryKeys, viewerQueryKeys } from './key'
import { getQueryClient } from './queryClient'
import { clearArticleViewAcks, readArticleViewAck } from './viewAck'
import { trackArticleView } from './viewTracker'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

describe('trackArticleView', () => {
  const result = (overrides = {}) => ({
    tracked: true,
    articleStats: {
      community: 'home',
      thread: THREAD.POST,
      innerId: '42',
      views: 11,
      viewsRevision: 3,
      upvotesCount: 2,
      commentsCount: 4,
      collectsCount: 1,
      commentsParticipantsCount: 3,
      interactionRevision: 5,
      commentsRevision: 6,
      emotionCounts: [{ type: 'HEART', count: 2 }],
      snapshotAt: '2026-09-25T00:00:00Z',
    },
    viewerState: {
      community: 'home',
      thread: THREAD.POST,
      innerId: '42',
      viewerHasViewed: true,
    },
    ...overrides,
  })

  beforeEach(() => {
    browserGraphQLRequest.mockReset()
    clearArticleViewAcks()
    getQueryClient().clear()
  })

  afterEach(() => vi.restoreAllMocks())

  it('stores the acknowledgement and applies returned public/private state', async () => {
    const queryClient = getQueryClient()
    const viewerKey = viewerQueryKeys.articleStates('account:1', ['home:POST:42'])
    const statsKey = articleQueryKeys.stats('home', THREAD.POST, '42')
    const batchKey = articleQueryKeys.statsBatch('home', THREAD.POST, ['42'])
    const current = result().articleStats
    queryClient.setQueryData(statsKey, { ...current, views: 10, viewsRevision: 2 })
    queryClient.setQueryData(batchKey, [{ ...current, views: 10, viewsRevision: 2 }])
    queryClient.setQueryData(viewerKey, {})
    browserGraphQLRequest.mockResolvedValue({
      trackArticleView: result(),
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(browserGraphQLRequest).toHaveBeenCalledWith(expect.anything(), {
      article: { community: 'home', innerId: '42', thread: THREAD.POST },
    })
    expect(readArticleViewAck('home:POST:42')).not.toBeNull()
    expect(queryClient.getQueryData(statsKey)).toMatchObject({
      views: 11,
      viewsRevision: 3,
    })
    expect(queryClient.getQueryData<(typeof current)[]>(batchKey)?.[0]).toMatchObject({
      views: 11,
      viewsRevision: 3,
    })
    expect(queryClient.getQueryData(viewerKey)).toMatchObject({
      'home:POST:42': { viewerHasViewed: true },
    })
  })

  it('retries the same Article without a client id', async () => {
    browserGraphQLRequest.mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce({
      trackArticleView: result(),
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(browserGraphQLRequest.mock.calls[0][1]).toEqual(browserGraphQLRequest.mock.calls[1][1])
  })

  it('does not retry a deterministic request error', async () => {
    browserGraphQLRequest.mockRejectedValueOnce(new Error('forbidden'))

    await expect(
      trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST }),
    ).rejects.toThrow('forbidden')
    expect(browserGraphQLRequest).toHaveBeenCalledTimes(1)
  })

  it('does not create an acknowledgement for a policy-excluded read', async () => {
    browserGraphQLRequest.mockResolvedValue({
      trackArticleView: result({ tracked: false }),
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(readArticleViewAck('home:POST:42')).toBeNull()
  })
})
