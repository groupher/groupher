import type { TArticle, TComment } from '~/spec'

import {
  mergeArticleCommentsProjection,
  preserveArticleProjection,
  preserveCommentProjection,
} from './revisionGuard'

describe('revision guards', () => {
  it('keeps newer Article interaction, comment, and view domains independently', () => {
    const previous = {
      innerId: '42',
      community: { slug: 'home' },
      meta: { thread: 'POST', latestUpvotedUsers: [{ login: 'alice' }] },
      title: 'old title',
      upvotesCount: 10,
      articleInteractionRevision: 5,
      commentsCount: 8,
      commentsRevision: 7,
      views: 20,
      viewsRevision: 3,
    } as unknown as TArticle
    const next = {
      ...previous,
      title: 'new title',
      upvotesCount: 2,
      articleInteractionRevision: 4,
      commentsCount: 9,
      commentsRevision: 8,
      views: 12,
      viewsRevision: 2,
    } as unknown as TArticle

    expect(preserveArticleProjection(previous, next)).toMatchObject({
      title: 'new title',
      upvotesCount: 10,
      articleInteractionRevision: 5,
      commentsCount: 9,
      commentsRevision: 8,
      views: 20,
      viewsRevision: 3,
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

  it('does not let Comment reconcile overwrite a newer Article comments projection', () => {
    const current = {
      innerId: '42',
      community: { slug: 'home' },
      meta: { thread: 'POST' },
      commentsCount: 12,
      commentsRevision: 9,
    } as unknown as TArticle

    expect(
      mergeArticleCommentsProjection(current, { commentsCount: 10, commentsRevision: 8 }),
    ).toBe(current)
    expect(
      mergeArticleCommentsProjection(current, { commentsCount: 13, commentsRevision: 10 }),
    ).toMatchObject({ commentsCount: 13, commentsRevision: 10 })
  })
})
