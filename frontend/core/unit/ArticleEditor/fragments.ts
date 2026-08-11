import { graphql } from '~/graphql/authoring'

export const ArticleEditorAuthorFields = graphql(`
  fragment ArticleEditorAuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const ArticleEditorCommunityFields = graphql(`
  fragment ArticleEditorCommunityFields on Community {
    title
    slug
    index
    desc
    logo
    subscribersCount
    homepage
    articlesCount
    views
    pending
    insertedAt
    updatedAt
  }
`)

export const ArticleEditorTagFields = graphql(`
  fragment ArticleEditorTagFields on CommunityTag {
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
