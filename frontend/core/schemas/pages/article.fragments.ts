import { graphql } from '~/graphql/authoring'

export const AuthorFields = graphql(`
  fragment AuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const CommonUserFields = graphql(`
  fragment CommonUserFields on CommonUser {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const CommunityFields = graphql(`
  fragment CommunityFields on Community {
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

export const TagFields = graphql(`
  fragment TagFields on CommunityTag {
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

export const PostFields = graphql(`
  fragment PostFields on Post {
    innerId
    version
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    author {
      ...AuthorFields
    }
    community {
      ...CommunityFields
    }
    communities {
      ...CommunityFields
    }
    communityTags {
      ...TagFields
    }
  }
`)

export const PostDetailFields = graphql(`
  fragment PostDetailFields on Post {
    meta {
      thread
      isEdited
      latestUpvotedUsers {
        ...CommonUserFields
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

export const ChangelogFields = graphql(`
  fragment ChangelogFields on Changelog {
    innerId
    version
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    author {
      ...AuthorFields
    }
    community {
      ...CommunityFields
    }
    communities {
      ...CommunityFields
    }
    communityTags {
      ...TagFields
    }
  }
`)

export const ChangelogDetailFields = graphql(`
  fragment ChangelogDetailFields on Changelog {
    meta {
      thread
      isEdited
      latestUpvotedUsers {
        ...CommonUserFields
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

export const DocFields = graphql(`
  fragment DocFields on Doc {
    innerId
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    author {
      ...AuthorFields
    }
    community {
      ...CommunityFields
    }
    communities {
      ...CommunityFields
    }
    communityTags {
      ...TagFields
    }
  }
`)

export const DocDetailFields = graphql(`
  fragment DocDetailFields on Doc {
    meta {
      thread
      isEdited
      latestUpvotedUsers {
        ...CommonUserFields
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

export const PagedCommunitiesPageInfo = graphql(`
  fragment PagedCommunitiesPageInfo on CommunityPage {
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

export const PostLiteFields = graphql(`
  fragment PostLiteFields on PostLite {
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

export const ChangelogLiteFields = graphql(`
  fragment ChangelogLiteFields on ChangelogLite {
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

export const DocLiteFields = graphql(`
  fragment DocLiteFields on DocLite {
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
