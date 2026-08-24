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

  it('maps community-scoped post restore mutations to post tags', () => {
    expect(
      mutationCacheTags(
        'mutation restoreTrashedPost($community: String!, $id: ID!) { restoreTrashedArticle(community: $community, id: $id, thread: POST) { innerId } }',
        { community: 'home', id: '42' },
      ),
    ).toEqual(['community[home]-thread[POST]-article[42]', 'community[home]-thread[POST]-articles'])
  })

  it('maps document publishing to only the document list and tree tags', () => {
    expect(
      mutationCacheTags(
        'mutation publishDocChanges($community: String!, $input: DocPublishChangesInput) { publishDocChanges(community: $community, input: $input) { done } }',
        {
          community: 'home',
          input: { docChangeIds: ['change:42'], treeChangeIds: ['tree:7'] },
        },
      ),
    ).toEqual(['community[home]-thread[DOC]-articles', 'community[home]-doc-tree'])
  })

  it('does not treat publishDocChanges as an article mutation without its community rule', () => {
    expect(
      mutationCacheTags('mutation publishDocChanges { publishDocChanges { done } }', { article }),
    ).toEqual([])
  })

  it('invalidates the public document tree for community-scoped tree mutations', () => {
    expect(
      mutationCacheTags(
        'mutation UpdateDocTreeNode($community: String!, $id: ID!) { updateDocTreeNode(community: $community, id: $id) { revision } }',
        { community: 'home', id: 'node-1' },
      ),
    ).toEqual(['community[home]-doc-tree'])
  })
})
