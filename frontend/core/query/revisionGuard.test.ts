import type { TComment } from '~/spec'

import { preserveCommentProjection } from './revisionGuard'

describe('revision guards', () => {
  it('guards nested Comment reaction projections in paged data', () => {
    const previous = {
      entries: [
        {
          innerId: '1',
          bodyHtml: 'old body',
          upvotesCount: 4,
          commentInteractionRevision: 9,
          replies: [
            {
              innerId: '2',
              bodyHtml: 'old reply',
              upvotesCount: 3,
              commentInteractionRevision: 8,
              replies: [],
            },
          ],
        },
      ],
    } as unknown as { entries: TComment[] }
    const next = {
      entries: [
        {
          innerId: '1',
          bodyHtml: 'new body',
          upvotesCount: 1,
          commentInteractionRevision: 7,
          replies: [
            {
              innerId: '2',
              bodyHtml: 'new reply',
              upvotesCount: 1,
              commentInteractionRevision: 7,
              replies: [],
            },
          ],
        },
      ],
    } as unknown as { entries: TComment[] }

    expect(preserveCommentProjection(previous, next)).toMatchObject({
      entries: [
        {
          bodyHtml: 'new body',
          upvotesCount: 4,
          commentInteractionRevision: 9,
          replies: [{ bodyHtml: 'new reply', upvotesCount: 3, commentInteractionRevision: 8 }],
        },
      ],
    })
  })
})

it('REV-02 preserves a newer root summary while refreshing profile leaves at the same revision', () => {
  const current: TComment = {
    innerId: '1',
    body: {},
    repliesRevision: 5,
    repliesCount: 2,
    hasReplyEntries: true,
    lastReplyAt: '2026-11-05T10:00:00Z',
    replyParticipants: [{ ref: 'stable-user', login: 'old-login', avatar: 'old' }],
  }
  const stale = { ...current, repliesRevision: 4, repliesCount: 1, replyParticipants: [] }
  expect(preserveCommentProjection(current, stale)).toMatchObject({
    repliesCount: 2,
    repliesRevision: 5,
    replyParticipants: current.replyParticipants,
  })
  const refreshed = {
    ...current,
    replyParticipants: [{ ref: 'stable-user', login: 'new-login', avatar: 'new' }],
  }
  expect(preserveCommentProjection(current, refreshed)).toMatchObject({
    replyParticipants: refreshed.replyParticipants,
    repliesRevision: 5,
  })
})

it('REV-02 rejects equal-version summary membership changes', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const current: TComment = {
    innerId: '1',
    body: {},
    repliesRevision: 5,
    repliesCount: 1,
    hasReplyEntries: true,
    replyParticipants: [{ ref: 'one', login: 'alice' }],
  }
  const invalid = { ...current, replyParticipants: [{ ref: 'two', login: 'bob' }] }
  expect(preserveCommentProjection(current, invalid)).toMatchObject({
    replyParticipants: current.replyParticipants,
  })
  expect(warn).toHaveBeenCalled()
})
