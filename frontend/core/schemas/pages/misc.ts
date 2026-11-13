import { graphql } from '~/graphql/authoring'

export const communityTagGroups = graphql(`
  "Get community tag groups"
  query CommunityTagGroups($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ...TagFields
      }
    }
  }
`)

export const communityTagStats = graphql(`
  "Get community tag stats by community, thread and slug"
  query CommunityTagStats($community: String!, $thread: Thread!, $slug: String!) {
    communityTagStats(community: $community, thread: $thread, slug: $slug) {
      contentsCount
      todayContentsCount
    }
  }
`)

export const themePresets = graphql(`
  "Dashboard theme preset registry"
  query ThemePresets {
    themePresets {
      value
      tokens
    }
  }
`)

export const categories = graphql(`
  "Get all categories"
  query Categories {
    categories {
      id
      title
      slug
      index
    }
  }
`)
