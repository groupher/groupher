import { graphql } from '~/graphql/authoring'

export const ArticleMenuTagFields = graphql(`
  fragment ArticleMenuTagFields on CommunityTag {
    id
    title
    layout
    desc
    slug
    color
    marker {
      type
      provider
      name
      src
      unified
    }
    thread
    group
    groupId
    index
    community {
      slug
    }
  }
`)
