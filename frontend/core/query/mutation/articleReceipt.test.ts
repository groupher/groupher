import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'
import type { TArticle } from '~/spec'

import {
  clearArticleUpvoteReceipt,
  overlayArticleUpvoteReceipt,
  readArticleUpvoteReceipt,
  writeArticleUpvoteReceipt,
} from './articleReceipt'

describe('article upvote receipts', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('keeps the latest confirmed projection for one account/entity slot', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-1',
      upvotesCount: 11,
      viewerHasUpvoted: true,
      articleInteractionRevision: 42,
    })
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-2',
      upvotesCount: 10,
      viewerHasUpvoted: false,
      articleInteractionRevision: 43,
    })

    expect(readArticleUpvoteReceipt('acct-a', 'home:POST:42')).toMatchObject({
      commandKey: 'op-2',
      schemaVersion: 2,
      publicProjection: { upvotesCount: 10, articleInteractionRevision: 43 },
      viewerState: { viewerHasUpvoted: false },
    })
    expect(readArticleUpvoteReceipt('acct-b', 'home:POST:42')).toBeNull()
  })

  it('removes a receipt explicitly when the public revision catches up', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-1',
      upvotesCount: 11,
      viewerHasUpvoted: true,
    })

    clearArticleUpvoteReceipt('acct-a', 'home:POST:42')

    expect(readArticleUpvoteReceipt('acct-a', 'home:POST:42')).toBeNull()
  })

  it('outlives the configured public CDN stale window', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-ttl',
      upvotesCount: 11,
      viewerHasUpvoted: true,
    })

    const receipt = readArticleUpvoteReceipt('acct-a', 'home:POST:42')
    expect((receipt?.expiresAt || 0) - (receipt?.confirmedAt || 0)).toBe(
      CONFIRMED_WRITE_RECEIPT_TTL_MS,
    )
  })

  it('does not let an unversioned late response replace a versioned receipt', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-new',
      upvotesCount: 11,
      viewerHasUpvoted: true,
      articleInteractionRevision: 42,
    })
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-legacy',
      upvotesCount: 10,
      viewerHasUpvoted: false,
    })

    expect(readArticleUpvoteReceipt('acct-a', 'home:POST:42')?.commandKey).toBe('op-new')
  })

  it('preserves an explicit null viewer emotion from a confirmed projection', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandKey: 'op-clear',
      upvotesCount: 10,
      viewerHasUpvoted: false,
      viewerEmotion: null,
    })
    const receipt = readArticleUpvoteReceipt('acct-a', 'home:POST:42')
    expect(
      receipt && overlayArticleUpvoteReceipt({ viewerEmotion: 'HEART' } as TArticle, receipt),
    ).toMatchObject({ viewerEmotion: null })
  })
})
