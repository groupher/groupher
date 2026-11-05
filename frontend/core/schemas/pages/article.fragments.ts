import { graphql } from '~/graphql/authoring'

export const PageAuthorFields = graphql(`
  fragment PageAuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const PageCommonUserFields = graphql(`
  fragment PageCommonUserFields on CommonUser {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const PageCommunityFields = graphql(`
  fragment PageCommunityFields on Community {
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

export const PageTagFields = graphql(`
  fragment PageTagFields on CommunityTag {
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

export const PagePostFields = graphql(`
  fragment PagePostFields on Post {
    innerId
    version
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    author {
      ...PageAuthorFields
    }
    community {
      ...PageCommunityFields
    }
    communities {
      ...PageCommunityFields
    }
    communityTags {
      ...PageTagFields
    }
  }
`)

export const PagePostDetailFields = graphql(`
  fragment PagePostDetailFields on Post {
    meta {
      thread
      isEdited
      latestUpvotedUsers {
        ...PageCommonUserFields
      }
    }
    body {
      json
      html
      markdown
      toc {
        id

        level

        title
      }
    }
    commentsParticipants {
      ref
      login
      nickname
      avatar
    }
    lifecycle {
      state
      version
      archivedAt
    }
  }
`)

export const PageChangelogFields = graphql(`
  fragment PageChangelogFields on Changelog {
    innerId
    version
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    author {
      ...PageAuthorFields
    }
    community {
      ...PageCommunityFields
    }
    communities {
      ...PageCommunityFields
    }
    communityTags {
      ...PageTagFields
    }
  }
`)

export const PageChangelogDetailFields = graphql(`
  fragment PageChangelogDetailFields on Changelog {
    meta {
      thread
      isEdited
      latestUpvotedUsers {
        ...PageCommonUserFields
      }
    }
    body {
      json
      html
      markdown
      toc {
        id

        level

        title
      }
    }
    commentsParticipants {
      ref
      login
      nickname
      avatar
    }
    lifecycle {
      state
      version
      archivedAt
    }
  }
`)

export const PageDocFields = graphql(`
  fragment PageDocFields on Doc {
    innerId
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    author {
      ...PageAuthorFields
    }
    community {
      ...PageCommunityFields
    }
    communities {
      ...PageCommunityFields
    }
    communityTags {
      ...PageTagFields
    }
  }
`)

export const PageDocDetailFields = graphql(`
  fragment PageDocDetailFields on Doc {
    meta {
      thread
      isEdited
      latestUpvotedUsers {
        ...PageCommonUserFields
      }
    }
    body {
      json
      html
      markdown
      toc {
        id

        level

        title
      }
    }
    commentsParticipants {
      ref
      login
      nickname
      avatar
    }
    lifecycle {
      state
      version
      archivedAt
    }
  }
`)

export const PageCommunityPageInfo = graphql(`
  fragment PageCommunityPageInfo on CommunityPage {
    pageInfo {
      __typename
      hasNextPage
      hasPreviousPage
      ... on OffsetPageInfo {
        page
        size
        totalCount
        totalPages
      }
      ... on CursorPageInfo {
        startCursor
        endCursor
      }
    }
  }
`)

export const PagePostLiteFields = graphql(`
  fragment PagePostLiteFields on PostLite {
    id
    thread
    innerId
    title
    digest
    isPinned
    cat
    insertedAt
    activeAt
    author {
      login
      nickname
      avatar
      bio
      shortbio
    }
    community {
      title
      slug
      logo
    }
    communityTags {
      id
      title
      layout
      slug
      color
      thread
    }
  }
`)

export const PageChangelogLiteFields = graphql(`
  fragment PageChangelogLiteFields on ChangelogLite {
    id
    thread
    innerId
    title
    digest
    isPinned
    cat
    status
    insertedAt
    activeAt
    author {
      login
      nickname
      avatar
      bio
      shortbio
    }
    community {
      title
      slug
      logo
    }
    communityTags {
      id
      title
      layout
      slug
      color
      thread
    }
  }
`)

export const PageDocLiteFields = graphql(`
  fragment PageDocLiteFields on DocLite {
    id
    thread
    innerId
    title
    digest
    isPinned
    cat
    status
    insertedAt
    activeAt
    author {
      login
      nickname
      avatar
      bio
      shortbio
    }
    community {
      title
      slug
      logo
    }
    communityTags {
      id
      title
      layout
      slug
      color
      thread
    }
  }
`)
