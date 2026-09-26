import { THREAD } from '~/const/thread'

import { articleKeys, viewerKeys } from './key'
import { getQueryClient } from './queryClient'
import { clearArticleViewReceipts, readArticleViewReceipt } from './viewReceipt'
import { trackArticleView } from './viewTracker'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

describe('trackArticleView', () => {
  const result = (overrides = {}) => ({
    counted: true,
    decisionReason: 'COUNTED',
    eventId: '00000000-0000-4000-8000-000000000042',
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
      reactionCounts: [{ type: 'HEART', count: 2 }],
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
    clearArticleViewReceipts()
    getQueryClient().clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000042')
  })

  afterEach(() => vi.restoreAllMocks())

  it('stores the committed receipt and applies returned public/private state', async () => {
    const queryClient = getQueryClient()
    const viewerKey = viewerKeys.articleStates('account:1', ['home:POST:42'])
    queryClient.setQueryData(viewerKey, {})
    browserGraphQLRequest.mockResolvedValue({
      trackArticleView: result(),
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(browserGraphQLRequest).toHaveBeenCalledWith(expect.anything(), {
      article: { community: 'home', innerId: '42', thread: THREAD.POST },
      eventId: '00000000-0000-4000-8000-000000000042',
    })
    expect(readArticleViewReceipt('home:POST:42')).toMatchObject({
      eventId: '00000000-0000-4000-8000-000000000042',
    })
    expect(queryClient.getQueryData(articleKeys.stats('home', THREAD.POST, '42'))).toMatchObject({
      views: 11,
      viewsRevision: 3,
    })
    expect(queryClient.getQueryData(viewerKey)).toMatchObject({
      'home:POST:42': { viewerHasViewed: true },
    })
  })

  it('reuses the event id for a transport retry', async () => {
    browserGraphQLRequest.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      trackArticleView: result(),
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(browserGraphQLRequest.mock.calls[0][1].eventId).toBe(
      browserGraphQLRequest.mock.calls[1][1].eventId,
    )
  })

  it('does not create a viewer receipt for a policy-excluded read', async () => {
    browserGraphQLRequest.mockResolvedValue({
      trackArticleView: result({ counted: false, decisionReason: 'EXCLUDED_BY_POLICY' }),
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(readArticleViewReceipt('home:POST:42')).toBeNull()
  })
})
