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
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    views
    commentsCount
    upvotesCount
    commentsParticipantsCount
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
    document {
      json
      html
      markdown
      markdownToc
    }
    commentsParticipants {
      ...PageAuthorFields
    }
    collectsCount
    archivedAt
    isArchived
    viewerHasCollected @include(if: $userHasLogin)
    viewerHasUpvoted @include(if: $userHasLogin)
  }
`)

export const PageChangelogFields = graphql(`
  fragment PageChangelogFields on Changelog {
    innerId
    isPinned
    title
    insertedAt
    activeAt
    updatedAt
    views
    commentsCount
    upvotesCount
    commentsParticipantsCount
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
    document {
      json
      html
      markdown
      markdownToc
    }
    commentsParticipants {
      ...PageAuthorFields
    }
    collectsCount
    archivedAt
    isArchived
    viewerHasCollected @include(if: $userHasLogin)
    viewerHasUpvoted @include(if: $userHasLogin)
  }
`)

export const PagePostPageInfo = graphql(`
  fragment PagePostPageInfo on PagedPosts {
    totalPages
    totalCount
    pageSize
    pageNumber
  }
`)

export const PageChangelogPageInfo = graphql(`
  fragment PageChangelogPageInfo on PagedChangelogs {
    totalPages
    totalCount
    pageSize
    pageNumber
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
    views
    commentsCount
    upvotesCount
    commentsParticipantsCount
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
    document {
      json
      html
      markdown
      markdownToc
    }
    commentsParticipants {
      ...PageAuthorFields
    }
    collectsCount
    archivedAt
    isArchived
    viewerHasCollected @include(if: $userHasLogin)
    viewerHasUpvoted @include(if: $userHasLogin)
  }
`)

export const PageDocPageInfo = graphql(`
  fragment PageDocPageInfo on PagedDocs {
    totalPages
    totalCount
    pageSize
    pageNumber
  }
`)

export const PageCommunityPageInfo = graphql(`
  fragment PageCommunityPageInfo on PagedCommunities {
    totalPages
    totalCount
    pageSize
    pageNumber
  }
`)
