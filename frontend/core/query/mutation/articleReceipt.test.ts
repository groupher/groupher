import { CONFIRMED_WRITE_RECEIPT_TTL_MS } from '~/constant/cache'
import type { TArticleStats } from '~/spec'

import {
  clearArticleUpvoteReceipt,
  overlayArticleUpvoteReceiptOnViewerState,
  readArticleUpvoteReceipt,
  writeArticleUpvoteReceipt,
} from './articleReceipt'

describe('article upvote receipts', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('keeps the latest confirmed projection for one account/entity slot', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandId: 'op-1',
      viewerHasUpvoted: true,
      interactionRevision: 42,
    })
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandId: 'op-2',
      viewerHasUpvoted: false,
      interactionRevision: 43,
    })

    expect(readArticleUpvoteReceipt('acct-a', 'home:POST:42')).toMatchObject({
      commandId: 'op-2',
      schemaVersion: 4,
      interactionRevision: 43,
      viewerState: { viewerHasUpvoted: false },
    })
    expect(readArticleUpvoteReceipt('acct-b', 'home:POST:42')).toBeNull()
  })

  it('removes a receipt explicitly after private reconciliation', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandId: 'op-1',
      viewerHasUpvoted: true,
    })

    clearArticleUpvoteReceipt('acct-a', 'home:POST:42')

    expect(readArticleUpvoteReceipt('acct-a', 'home:POST:42')).toBeNull()
  })

  it('outlives the configured public CDN stale window', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandId: 'op-ttl',
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
      commandId: 'op-new',
      viewerHasUpvoted: true,
      interactionRevision: 42,
    })
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandId: 'op-legacy',
      viewerHasUpvoted: false,
    })

    expect(readArticleUpvoteReceipt('acct-a', 'home:POST:42')?.commandId).toBe('op-new')
  })

  it('preserves an explicit null viewer emotion from a confirmed projection', () => {
    writeArticleUpvoteReceipt({
      accountRef: 'acct-a',
      entityKey: 'home:POST:42',
      commandId: 'op-clear',
      viewerHasUpvoted: false,
      viewerEmotion: null,
    })
    const receipt = readArticleUpvoteReceipt('acct-a', 'home:POST:42')
    expect(
      receipt &&
        overlayArticleUpvoteReceiptOnViewerState(
          { interactionRevision: 0 } as TArticleStats,
          { articleKey: 'home:POST:42', viewerEmotion: 'HEART' },
          receipt,
        ),
    ).toMatchObject({ viewerEmotion: null })
  })
})
