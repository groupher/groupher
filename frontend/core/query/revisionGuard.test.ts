import type { TArticle, TComment } from '~/spec'

import { preserveArticleProjection, preserveCommentProjection } from './revisionGuard'

describe('revision guards', () => {
  it('keeps newer Article interaction and comment domains independently', () => {
    const previous = {
      innerId: '42',
      community: { slug: 'home' },
      meta: { thread: 'POST', latestUpvotedUsers: [{ login: 'alice' }] },
      title: 'old title',
      articleInteractionRevision: 5,
    } as unknown as TArticle
    const next = {
      ...previous,
      title: 'new title',
      articleInteractionRevision: 4,
    } as unknown as TArticle

    expect(preserveArticleProjection(previous, next)).toMatchObject({
      title: 'new title',
      articleInteractionRevision: 5,
    })
  })

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
