import F from '../fragments'

export const changelog = `
  query changelog($article: ArticleRefInput!, $userHasLogin: Boolean!) {
    changelog(article: $article) {
      ${F.article}
      ${F.articleDetail}
    }
  }
`
export const pagedChangelogs = `
  query pagedChangelogs($filter: PagedChangelogsFilter!, $userHasLogin: Boolean!) {
    pagedChangelogs(filter: $filter) {
      entries {
        ${F.article}        
        meta {
          thread
          latestUpvotedUsers {
            ${F.author}
          }
        }
        digest
        linkAddr
        commentsParticipants {
          ${F.author}
        }
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
      ${F.pagi}
    }
  }
`
