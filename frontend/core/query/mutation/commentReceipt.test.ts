import { CONFIRMED_COMMENT_RECEIPT_MAX_REFS } from '~/constant/cache'

import { readCommentFeedReceipts, writeCommentFeedReceipt } from './commentReceipt'

describe('comment feed receipts', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('deduplicates effects by comment ref and keeps the newest effect', () => {
    writeCommentFeedReceipt({
      type: 'create',
      commandId: 'op-create',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      comment: { innerId: 'comment-1', bodyHtml: 'old' },
      publicProjection: {},
    })
    writeCommentFeedReceipt({
      type: 'update',
      commandId: 'op-update',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      comment: { innerId: 'comment-1', bodyHtml: 'new' },
      publicProjection: {},
    })

    expect(readCommentFeedReceipts('acct-a', 'home:POST:42')).toHaveLength(1)
    expect(readCommentFeedReceipts('acct-a', 'home:POST:42')[0].comment?.bodyHtml).toBe('new')
  })

  it('stores a delete as a tombstone without copying the deleted comment payload', () => {
    writeCommentFeedReceipt({
      type: 'delete',
      commandId: 'op-delete',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      comment: { innerId: 'comment-1', bodyHtml: 'should-not-persist' },
      publicProjection: {},
    })

    const receipt = readCommentFeedReceipts('acct-a', 'home:POST:42')[0]
    expect(receipt.type).toBe('delete')
    expect(receipt.comment).toBeUndefined()
    expect(receipt.tombstone).toBe(true)
  })

  it('does not let an unversioned late effect replace a versioned effect', () => {
    writeCommentFeedReceipt({
      type: 'update',
      commandId: 'op-new',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      comment: { innerId: 'comment-1', bodyHtml: 'new' },
      publicProjection: { commentsRevision: 9 },
    })
    writeCommentFeedReceipt({
      type: 'update',
      commandId: 'op-legacy',
      accountRef: 'acct-a',
      articleKey: 'home:POST:42',
      commentRef: 'comment-1',
      comment: { innerId: 'comment-1', bodyHtml: 'old' },
      publicProjection: {},
    })

    expect(readCommentFeedReceipts('acct-a', 'home:POST:42')[0].commandId).toBe('op-new')
  })

  it('bounds the Article feed slot', () => {
    for (let index = 0; index <= CONFIRMED_COMMENT_RECEIPT_MAX_REFS; index += 1) {
      writeCommentFeedReceipt({
        type: 'create',
        commandId: `op-${index}`,
        accountRef: 'acct-a',
        articleKey: 'home:POST:42',
        commentRef: `comment-${index}`,
        comment: { innerId: `comment-${index}` },
        publicProjection: {},
      })
    }

    expect(readCommentFeedReceipts('acct-a', 'home:POST:42')).toHaveLength(
      CONFIRMED_COMMENT_RECEIPT_MAX_REFS,
    )
  })
})
