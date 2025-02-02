import F from '../fragments'

export const pagedArticleTags = `
  query ($filter: ArticleTagsFilter) {
    pagedArticleTags(filter: $filter) {
      entries {
        ${F.tag}
      }
    }
  }
`

export const pagedCategories = `
  query($filter: PagiFilter!) {
    pagedCategories(filter: $filter) {
      entries {
        id
        title
        slug
        index
      }
      ${F.pagi}
    }
  }
`
