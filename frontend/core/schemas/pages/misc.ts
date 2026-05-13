import F from '../fragments'

export const communityTagGroups = `
  query ($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ${F.tag}
      }
    }
  }
`

export const communityTagStats = `
  query ($community: String!, $thread: Thread!, $slug: String!) {
    communityTagStats(community: $community, thread: $thread, slug: $slug) {
      contentsCount
      todayContentsCount
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
