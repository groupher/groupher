import { gql } from 'urql'

import { F } from '~/schemas'

// post
const createPost = gql`
  mutation (
    $title: String!
    $bodyBag: ArtimentBodyBagInput!
    $community: String!
    $communityTags: [ID]
    $linkAddr: String
    $copyRight: String
  ) {
    createPost(
      title: $title
      bodyBag: $bodyBag
      community: $community
      communityTags: $communityTags
      linkAddr: $linkAddr
      copyRight: $copyRight
    ) {
      innerId
      title
      meta {
        thread
      }
    }
  }
`
const updatePost = gql`
  mutation (
    $article: ArticlePathInput!
    $title: String
    $bodyBag: ArtimentBodyBagInput
    $linkAddr: String
    $copyRight: String
    $communityTags: [ID]
  ) {
    updatePost(
      article: $article
      title: $title
      bodyBag: $bodyBag
      linkAddr: $linkAddr
      copyRight: $copyRight
      communityTags: $communityTags
    ) {
      innerId
      title
      author {
        ${F.author}
      }
      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    }
  }
`

const createJob = gql`
  mutation (
    $title: String!
    $body: String!
    $community: String!
    $company: String!
    $companyLink: String
    $communityTags: [ID]
  ) {
    createJob(
      title: $title
      body: $body
      community: $community
      company: $company
      companyLink: $companyLink
      communityTags: $communityTags
    ) {
      innerId
      title
      meta {
        thread
      }
    }
  }
`

const updateJob = gql`
  mutation (
    $article: ArticlePathInput!
    $title: String
    $company: String!
    $companyLink: String
    $body: String
    $communityTags: [ID]
  ) {
    updateJob(
      article: $article
      title: $title
      company: $company
      companyLink: $companyLink
      body: $body
      communityTags: $communityTags
    ) {
      innerId
      title
      author {
        ${F.author}
      }
      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    }
  }
`

// radar
const createRadar = gql`
  mutation (
    $title: String!
    $body: String
    $linkAddr: String!
    $community: String!
    $communityTags: [ID]
  ) {
    createRadar(
      title: $title
      body: $body
      linkAddr: $linkAddr
      community: $community
      communityTags: $communityTags
    ) {
      innerId
      title
      meta {
        thread
      }
    }
  }
`
const updateRadar = gql`
  mutation (
    $article: ArticlePathInput!
    $title: String
    $body: String
    $linkAddr: String
    $communityTags: [ID]
  ) {
    updateRadar(
      article: $article
      title: $title
      body: $body
      linkAddr: $linkAddr
      communityTags: $communityTags
    ) {
      innerId
      title
      author {
        ${F.author}
      }
      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    }
  }
`

// viewer_has_subscribed
const community = gql`
  query ($slug: String!) {
    community(slug: $slug) {
      logo
      title
      slug
      desc
      subscribersCount
    }
  }
`

const post = gql`
  query post($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
      title
      linkAddr
      copyRight
      archivedAt
      isArchived
      author {
        ${F.author}
      }

      community {
        ${F.community}
      }

      communityTags {
        ${F.tag}
      }

      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    
      document {
        body
      }
    }
  }
`
const job = gql`
  query job($article: ArticlePathInput!) {
    job(article: $article) {
      innerId
      title
      company
      companyLink
      copyRight
      archivedAt
      isArchived

      author {
        ${F.author}
      }

      community {
        ${F.community}
      }

      communityTags {
        ${F.tag}
      }

      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    
      document {
        body
      }
    }
  }
`
const radar = gql`
  query radar($article: ArticlePathInput!) {
    radar(article: $article) {
      innerId
      title
      linkAddr
      copyRight
      archivedAt
      isArchived

      community {
        ${F.community}
      }

      communityTags {
        ${F.tag}
      }

      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    
      document {
        body
      }
    }
  }
`
const schema = {
  post,
  job,
  radar,
  createPost,
  updatePost,
  createJob,
  updateJob,
  createRadar,
  updateRadar,
  community,
}

export default schema
