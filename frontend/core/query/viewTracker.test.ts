import { THREAD } from '~/const/thread'

import { clearArticleViewReceipts, readArticleViewReceipt } from './viewReceipt'
import { trackArticleView } from './viewTracker'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

describe('trackArticleView', () => {
  beforeEach(() => {
    browserGraphQLRequest.mockReset()
    clearArticleViewReceipts()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000042')
  })

  afterEach(() => vi.restoreAllMocks())

  it('uses a dedicated mutation and stores the accepted receipt', async () => {
    browserGraphQLRequest.mockResolvedValue({
      trackArticleView: { accepted: true, eventId: '00000000-0000-4000-8000-000000000042' },
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(browserGraphQLRequest).toHaveBeenCalledWith(expect.anything(), {
      article: { community: 'home', innerId: '42', thread: THREAD.POST },
      eventId: '00000000-0000-4000-8000-000000000042',
    })
    expect(readArticleViewReceipt('home:POST:42')).toMatchObject({
      accepted: true,
      viewEventId: '00000000-0000-4000-8000-000000000042',
    })
  })

  it('reuses the event id for a transport retry', async () => {
    browserGraphQLRequest.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      trackArticleView: { accepted: true, eventId: '00000000-0000-4000-8000-000000000042' },
    })

    await trackArticleView({ community: 'home', innerId: 42, thread: THREAD.POST })

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(browserGraphQLRequest.mock.calls[0][1].eventId).toBe(
      browserGraphQLRequest.mock.calls[1][1].eventId,
    )
  })
})
