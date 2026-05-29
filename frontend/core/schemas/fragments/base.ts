import { gql } from 'urql'

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
export const headerLink = `
  id
  type
  title
  url
  links {
    id
    title
    url
  }
`
export const footerOnelineLink = `
  id
  title
  url
`
export const wallpaper = `
  type
  source
  gradient
  bgSize
  hasPattern
  patternId
  patternIntensity
  patternTone
  hasTexture
  blurIntensity
  hasShadow
  brightness
  saturation
  texture
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
  groupId
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
  innerId
  communitySlug
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
  community {
    ${community}
  }
  communities {
    ${community}
  }
  communityTags {
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
    json
    html
    markdown
    markdownToc
    rss
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

export const emotionQuery = `
  type
  count
  viewerHasReacted
  latestUsers {
    login
    nickname
    avatar
  }
`

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
  community {
    ${community}
  }
  communities {
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
    mutation ($article: ArticleRefInput!) {
      upvote${titleCase(thread)}(article: $article) {
        innerId
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
    mutation ($article: ArticleRefInput!) {
      upvote${titleCase(thread)}(article: $article) {
        innerId
        upvotesCount
      }
    }
  `
}

export const getUndoUpvote = (thread, withLatestUser = false) => {
  if (withLatestUser) {
    return gql`
    mutation ($article: ArticleRefInput!) {
      undoUpvote${titleCase(thread)}(article: $article) {
        innerId
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
    mutation ($article: ArticleRefInput!) {
      undoUpvote${titleCase(thread)}(article: $article) {
        innerId
        upvotesCount
      }
    }
  `
}
