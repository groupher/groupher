import { gql } from 'urql'
import { F } from '~/schemas'

// post
const createPost = gql`
  mutation (
    $title: String!
    $body: String!
    $communityId: ID!
    $linkAddr: String
    $isQuestion: Boolean
    $communityTags: [Id]
  ) {
    createPost(
      title: $title
      body: $body
      communityId: $communityId
      linkAddr: $linkAddr
      isQuestion: $isQuestion
      communityTags: $communityTags
    ) {
      id
      title
      meta {
        thread
      }
    }
  }
`
const updatePost = gql`
  mutation (
    $id: ID!
    $title: String
    $body: String
    $linkAddr: String
    $copyRight: String
    $communityTags: [Id]
  ) {
    updatePost(
      id: $id
      title: $title
      body: $body
      linkAddr: $linkAddr
      copyRight: $copyRight
      communityTags: $communityTags
    ) {
      id
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
    $communityId: ID!
    $company: String!
    $companyLink: String
    $communityTags: [Id]
  ) {
    createJob(
      title: $title
      body: $body
      communityId: $communityId
      company: $company
      companyLink: $companyLink
      communityTags: $communityTags
    ) {
      id
      title
      meta {
        thread
      }
    }
  }
`

const updateJob = gql`
  mutation (
    $id: ID!
    $title: String
    $company: String!
    $companyLink: String
    $body: String
    $communityTags: [Ids]
  ) {
    updateJob(
      id: $id
      title: $title
      company: $company
      companyLink: $companyLink
      body: $body
      communityTags: $communityTags
    ) {
      id
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
    $communityId: ID!
    $communityTags: [Id]
  ) {
    createRadar(
      title: $title
      body: $body
      linkAddr: $linkAddr
      communityId: $communityId
      communityTags: $communityTags
    ) {
      id
      title
      meta {
        thread
      }
    }
  }
`
const updateRadar = gql`
  mutation (
    $id: ID!
    $title: String
    $body: String
    $linkAddr: String
    $communityTags: [Id]
  ) {
    updateRadar(
      id: $id
      title: $title
      body: $body
      linkAddr: $linkAddr
      communityTags: $communityTags
    ) {
      id
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
      id
      logo
      title
      slug
      desc
      subscribersCount
    }
  }
`

const post = gql`
  query post($id: ID!) {
    post(id: $id) {
      id
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

      articleTags {
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
  query job($id: ID!) {
    job(id: $id) {
      id
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

      articleTags {
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
  query radar($id: ID!) {
    radar(id: $id) {
      id
      title
      linkAddr
      copyRight
      archivedAt
      isArchived

      community {
        ${F.community}
      }

      articleTags {
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
