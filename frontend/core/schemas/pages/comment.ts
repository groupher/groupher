import F from '../fragments'

export const pagedComments = `
  query pagedComments(
    $article: ArticlePathInput!
    $mode: CommentsMode
    $filter: CommentsFilter!
  ) {
    pagedComments(article: $article, mode: $mode, filter: $filter) {
      entries {
        ${F.comment}
      }
      ${F.pagi}
    }
  }
`
