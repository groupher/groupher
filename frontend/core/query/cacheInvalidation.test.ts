import { THREAD } from '~/const/thread'

import { mutationCacheTags } from './cacheInvalidation'

describe('mutation cache tag mapping', () => {
  const article = { community: 'home', thread: THREAD.POST, innerId: '42' }

  it('maps an article mutation to exact detail and list tags', () => {
    expect(
      mutationCacheTags(
        'mutation QueryUpvotePost($article: ArticlePathInput!) { upvotePost(article: $article) { innerId } }',
        {
          article,
        },
      ),
    ).toEqual(['community[home]-thread[POST]-article[42]', 'community[home]-thread[POST]-articles'])
  })

  it('maps a comment mutation through its nested article path', () => {
    expect(
      mutationCacheTags(
        'mutation UpvoteComment($comment: CommentPathInput!) { upvoteComment(comment: $comment) { innerId } }',
        {
          comment: { article, innerId: '7' },
        },
      ),
    ).toEqual([
      'community[home]-thread[POST]-article[42]',
      'community[home]-thread[POST]-articles',
      'community[home]-thread[POST]-article[42]-comments',
    ])
  })

  it('ignores caller-provided tags and unknown operations', () => {
    expect(
      mutationCacheTags('mutation Unknown { unknown }', {
        article,
        tag: 'community[other]',
      }),
    ).toEqual([])
  })
})
