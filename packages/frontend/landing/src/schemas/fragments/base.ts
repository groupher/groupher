import { gql } from 'urql'
import { values, flatten } from 'ramda'

import EMOTION from '~/const/emotion'
import { titleCase } from '~/fmt'

export const community = `
  id
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

  threads {
    slug
    title
  }

  insertedAt
  updatedAt
`
export const customLink = `
  title
  link
  group
  groupIndex
  index
`
export const wallpaper = `
  wallpaperType
  wallpaper
  direction
  customColorValue
  bgSize
  uploadBgImage
  hasPattern
  hasBlur
  hasShadow
`
export const seo = `
  seoEnable
  ogSiteName
  ogTitle
  ogDescription
  ogUrl
  ogImage
  twTitle
  twDescription
  twUrl
  twCard
  twSite
  twImage
  twImageWidth
  twImageHeight
`
export const tag = `
  id
  title
  layout
  desc
  slug
  color
  thread
  group
  index
  community {
    slug
  }
`
export const author = `
  login
  nickname
  avatar
  bio
  shortbio
`
export const article = `
  id
  innerId
  originalCommunitySlug
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
    ${author}
  }
  originalCommunity {
    ${community}
  }
  communities {
    ${community}
  }
  articleTags {
    ${tag}
  }
`
export const articleDetail = `
  meta {
    thread
    isEdited
    latestUpvotedUsers {
      login
      avatar
      nickname
    }
  }

  document {
    bodyHtml
    body
  }

  commentsParticipants {
    ${author}
  }

  collectsCount
  archivedAt
  isArchived

  viewerHasCollected @include(if: $userHasLogin)
  viewerHasUpvoted @include(if: $userHasLogin)
`
export const pageArticleMeta = `
  meta {
    thread
    latestUpvotedUsers {
      login
      avatar
      nickname
    }
  }
`
export const post = `
  id
  innerId
  title
  insertedAt
  updatedAt
  views
`

export const userSocial = `
  github
  twitter
  company
  blog
`

export const user = `
  sex
  ${author}
  bio
  location
  social {
    ${userSocial}
  }
  followersCount
  followingsCount
`
export const c11n = `
  bannerLayout
  contentDivider
  markViewed
  displayDensity
  theme
`
export const achievement = `
  reputation
  articlesUpvotesCount
  articlesCollectsCount
  donateMember
  seniorMember
  sponsorMember
`
export const userBackgrounds = `
  workBackgrounds {
    company
    title
  }
  educationBackgrounds {
    school
    major
  }
`
export const userContributes = `
  records {
    count
    date
  }
  startDate
  endDate
  totalCount
`

export const emotionQuery = flatten(
  values(EMOTION).map((emotion) => {
    return [
      `${emotion}Count`,
      `viewerHas${titleCase(emotion)}ed`,
      `latest${titleCase(emotion)}Users { login nickname }`,
    ]
  }),
).join(' ')

// comment

export const commentFields = `
  id
  bodyHtml
  author {
    ${author}
  }
  meta {
    isLegal
    illegalReason
    illegalWords
    isArticleAuthorUpvoted
    isReplyToOthers
  }

  emotions {
    ${emotionQuery}
  }

  isPinned
  floor
  upvotesCount
  isArticleAuthor
  viewerHasUpvoted
  repliesCount
  replyToId
  insertedAt
  updatedAt
`
export const comment = `
  ${commentFields}

  replyTo {
    ${commentFields}
  }

  replies {
    ${commentFields}
    replyTo {
      author {
        login
        nickname
      }
      floor
    }
  }
`
export const commentParent = `
  id
  title
  commentsCount
  author {
    ${author}
  }
  communities {
    ${community}
  }
  originalCommunity {
    ${community}
  }
`
export const pagi = `
  totalPages
  totalCount
  pageSize
  pageNumber
`

export const getUpvote = (thread, withLatestUser = false) => {
  if (withLatestUser) {
    return gql`
    mutation ($id: ID!) {
      upvote${titleCase(thread)}(id: $id) {
        id
        upvotesCount
        meta {
          latestUpvotedUsers {
            ${author}
          }
        }
      }
    }
  `
  }
  return gql`
    mutation ($id: ID!) {
      upvote${titleCase(thread)}(id: $id) {
        id
        upvotesCount
      }
    }
  `
}

export const getUndoUpvote = (thread, withLatestUser = false) => {
  if (withLatestUser) {
    return gql`
    mutation ($id: ID!) {
      undoUpvote${titleCase(thread)}(id: $id) {
        id
        upvotesCount
        meta {
          latestUpvotedUsers {
            ${author}
          }
        }
      }
    }
  `
  }
  return gql`
    mutation ($id: ID!) {
      undoUpvote${titleCase(thread)}(id: $id) {
        id
        upvotesCount
      }
    }
  `
}
