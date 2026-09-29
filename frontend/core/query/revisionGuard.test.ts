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
