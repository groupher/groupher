import { describe, expect, it } from 'vitest'

import type { TComment, TPagedComments } from '~/spec'

import {
  extractCommentViewerStates,
  mergeCommentViewerState,
  stripPagedCommentViewerState,
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
    viewerHasReported: false,
    viewerHasUpvoted: false,
    ...overrides,
  }) as unknown as TComment

const page = (entries: TComment[]): TPagedComments =>
  ({ entries, pageNumber: 1, totalCount: entries.length }) as unknown as TPagedComments

describe('comment viewer state boundary', () => {
  it('strips viewer fields recursively from replies and replyToComment', () => {
    const source = page([
      comment('root', {
        replies: [comment('reply', { replyToComment: comment('quoted') })],
      }),
    ])

    const result = stripPagedCommentViewerState(source)
    const root = result.entries[0] as unknown as TComment
    const reply = root.replies[0]
    const quoted = reply.replyToComment

    for (const current of [root, reply, quoted]) {
      expect(current).not.toHaveProperty('viewerHasUpvoted')
      expect(current).not.toHaveProperty('viewerHasReported')
      expect(current?.emotions[0]).not.toHaveProperty('viewerHasReacted')
    }
  })

  it('extracts private flags without carrying public emotion counts', () => {
    const states = extractCommentViewerStates(
      page([comment('root', { replies: [comment('reply')] })]),
    )

    expect(states.root).toEqual({
      emotionFlags: { HEART: false },
      viewerHasReported: false,
      viewerHasUpvoted: false,
    })
    expect(states.reply).toBeDefined()
    expect(states.root).not.toHaveProperty('emotions')
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
        viewerHasReported: true,
        viewerHasUpvoted: true,
      },
    })

    expect(result.upvotesCount).toBe(12)
    expect(result.viewerHasUpvoted).toBe(true)
    expect(result.viewerHasReported).toBe(true)
    expect(result.emotions).toEqual([
      { type: 'HEART', count: 8, latestUsers: [], viewerHasReacted: true },
      { type: 'BEER', count: 2, latestUsers: [] },
    ])
  })
})
