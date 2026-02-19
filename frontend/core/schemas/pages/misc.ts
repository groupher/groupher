import F from '../fragments'

export const pagedCommunityTags = `
  query ($filter: CommunityTagsFilter) {
    pagedCommunityTags(filter: $filter) {
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
