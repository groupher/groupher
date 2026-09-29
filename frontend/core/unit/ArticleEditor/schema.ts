import { graphql } from '~/graphql/authoring'

const createPost = graphql(`
  mutation CreatePost(
    $title: String!
    $bodyBag: ArtimentBodyBagInput!
    $community: String!
    $commandId: ID!
    $communityTags: [ID]
    $linkAddr: String
    $copyRight: String
  ) {
    createPost(
      title: $title
      bodyBag: $bodyBag
      community: $community
      commandId: $commandId
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
`)

const updatePost = graphql(`
  mutation UpdatePostFromEditor(
    $article: ArticlePathInput!
    $commandId: ID!
    $expectedVersion: Int!
    $title: String
    $bodyBag: ArtimentBodyBagInput
    $linkAddr: String
    $copyRight: String
    $communityTags: [ID]
  ) {
    updatePost(
      article: $article
      commandId: $commandId
      expectedVersion: $expectedVersion
      title: $title
      bodyBag: $bodyBag
      linkAddr: $linkAddr
      copyRight: $copyRight
      communityTags: $communityTags
    ) {
      innerId
      title
      author {
        ...ArticleEditorAuthorFields
      }
      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
    }
  }
`)

const community = graphql(`
  query ArticleEditorCommunity($slug: String!) {
    community(slug: $slug) {
      logo
      title
      slug
      desc
      subscribersCount
    }
  }
`)

const post = graphql(`
  query ArticleEditorPost($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
      version
      title
      linkAddr
      copyRight
      lifecycle {
        state
        version
        archivedAt
      }
      author {
        ...ArticleEditorAuthorFields
      }
      community {
        ...ArticleEditorCommunityFields
      }
      communityTags {
        ...ArticleEditorTagFields
      }
      meta {
        thread
        isLegal
        illegalReason
        illegalWords
      }
      document {
        json
      }
    }
  }
`)

export default {
  post,
  updatePost,
  createPost,
  community,
}
