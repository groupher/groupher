import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'

import {
  overlayCommentReactionReceipt,
  readCommentReactionReceipt,
  readCommentReactionReceipts,
  writeCommentReactionReceipt,
} from './commentReactionReceipt'

describe('comment reaction receipts', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('keeps the newest revision for one comment slot', () => {
    writeCommentReactionReceipt({
      commandId: 'op-1',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      upvotesCount: 4,
      emotions: [{ type: 'HEART', count: 1 }],
      viewerHasUpvoted: true,
      commentInteractionRevision: 9,
    })
    writeCommentReactionReceipt({
      commandId: 'op-old',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      upvotesCount: 3,
      emotions: [{ type: 'HEART', count: 0 }],
      viewerHasUpvoted: false,
      commentInteractionRevision: 8,
    })

    expect(readCommentReactionReceipt('acct-a', 'home:POST:42', 'comment-1')).toMatchObject({
      commandId: 'op-1',
      schemaVersion: 3,
      publicProjection: { commentInteractionRevision: 9 },
    })
  })

  it('overlays a confirmed public projection without replacing unrelated fields', () => {
    const comment = {
      innerId: 'comment-1',
      bodyHtml: 'body',
      upvotesCount: 1,
      emotions: [{ type: 'HEART', count: 0 }],
    }
    const receipt = {
      schemaVersion: 3 as const,
      commandId: 'op-1',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      publicProjection: {
        upvotesCount: 2,
        emotions: [{ type: 'HEART' as const, count: 1 }],
        commentInteractionRevision: 3,
      },
      viewerState: { viewerHasUpvoted: true },
      confirmedAt: Date.now(),
      expiresAt: Date.now() + 30_000,
    }

    expect(overlayCommentReactionReceipt(comment, receipt)).toMatchObject({
      bodyHtml: 'body',
      upvotesCount: 2,
      viewerHasUpvoted: true,
      commentInteractionRevision: 3,
    })
  })

  it('does not let an unversioned late response replace a versioned receipt', () => {
    writeCommentReactionReceipt({
      commandId: 'op-new',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      upvotesCount: 4,
      emotions: [],
      viewerHasUpvoted: true,
      commentInteractionRevision: 9,
    })
    writeCommentReactionReceipt({
      commandId: 'op-legacy',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      upvotesCount: 3,
      emotions: [],
      viewerHasUpvoted: false,
    })

    expect(readCommentReactionReceipt('acct-a', 'home:POST:42', 'comment-1')?.commandId).toBe(
      'op-new',
    )
  })

  it('bounds reaction receipts for one Article', () => {
    for (let index = 0; index <= CONFIRMED_COMMENT_RECEIPT_MAX_REFS; index += 1) {
      writeCommentReactionReceipt({
        commandId: `op-${index}`,
        accountRef: 'acct-a',
        articleKey: 'home:POST:42',
        commentRef: `comment-${index}`,
        upvotesCount: index,
        emotions: [],
        viewerHasUpvoted: true,
        commentInteractionRevision: index,
      })
    }

    expect(readCommentReactionReceipts('acct-a', 'home:POST:42')).toHaveLength(
      CONFIRMED_COMMENT_RECEIPT_MAX_REFS,
    )
  })
})
