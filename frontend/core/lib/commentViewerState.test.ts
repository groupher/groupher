import { describe, expect, it } from 'vitest'

import type { TComment, TPagedComments } from '~/spec'

import {
  gatherCommentViewerIds,
  mergeCommentViewerState,
  stripCommentViewerState,
} from './commentViewerState'

const comment = (innerId: string, overrides: Partial<TComment> = {}): TComment =>
  ({
    innerId,
    emotions: [
      {
        type: 'HEART',
        count: 3,
        latestUsers: [],
        viewerHasReacted: false,
      },
    ],
    replies: [],
    upvotesCount: 5,
    viewerHasUpvoted: false,
    ...overrides,
  }) as unknown as TComment

const page = (entries: TComment[]): TPagedComments =>
  ({ entries, pageNumber: 1, totalCount: entries.length }) as unknown as TPagedComments

describe('comment viewer state boundary', () => {
  it('strips viewer fields recursively from replies and replyToComment', () => {
    const root = stripCommentViewerState(
      comment('root', {
        replies: [comment('reply', { replyToComment: comment('quoted') })],
      }),
    )
    const reply = root.replies[0]
    const quoted = reply.replyToComment

    for (const current of [root, reply, quoted]) {
      expect(current).not.toHaveProperty('viewerHasUpvoted')
      expect(current?.emotions[0]).not.toHaveProperty('viewerHasReacted')
    }
  })

  it('gathers nested reply and replyToComment ids for the viewer batch', () => {
    const source = page([
      comment('root', {
        replies: [
          comment('reply', {
            replies: [comment('nested')],
            replyToComment: comment('quoted'),
          }),
        ],
      }),
    ])

    expect(gatherCommentViewerIds(source)).toEqual(['root', 'reply', 'nested', 'quoted'])
  })

  it('keeps public counts while overlaying viewer flags by emotion type', () => {
    const publicComment = comment('root', {
      emotions: [
        { type: 'HEART', count: 8, latestUsers: [] },
        { type: 'BEER', count: 2, latestUsers: [] },
      ],
      upvotesCount: 12,
    })
    const result = mergeCommentViewerState(publicComment, {
      root: {
        emotionFlags: { HEART: true },
        viewerHasUpvoted: true,
      },
    })

    expect(result.upvotesCount).toBe(12)
    expect(result.viewerHasUpvoted).toBe(true)
    expect(result.emotions).toEqual([
      { type: 'HEART', count: 8, latestUsers: [], viewerHasReacted: true },
      { type: 'BEER', count: 2, latestUsers: [] },
    ])
  })
})
