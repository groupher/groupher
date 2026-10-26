import { graphql } from '~/graphql/authoring'

const createPost = graphql(`
  mutation CreatePost(
    $title: String!
    $bodyBag: ArtimentBodyBagInput!
    $community: String!
    $commandId: ID!
    $communityTags: [ID]
    $cat: ArticleCatEnum
    $linkAddr: String
    $copyRight: String
  ) {
    createPost(
      title: $title
      bodyBag: $bodyBag
      community: $community
      commandId: $commandId
      communityTags: $communityTags
      cat: $cat
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
    $cat: ArticleCatEnum
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
      cat: $cat
    ) {
      innerId
      title
      author {
        ...ArticleEditorAuthorFields
      }
      meta {
        thread
      }
    }
  }
`)

const createBlog = graphql(`
  mutation CreateBlogFromPublisher(
    $title: String!
    $bodyBag: ArtimentBodyBagInput!
    $community: String!
    $commandId: ID!
    $communityTags: [ID]
  ) {
    createBlog(
      title: $title
      bodyBag: $bodyBag
      community: $community
      commandId: $commandId
      communityTags: $communityTags
    ) {
      innerId
      title
    }
  }
`)

const updateBlog = graphql(`
  mutation UpdateBlogFromPublisher(
    $article: ArticlePathInput!
    $commandId: ID!
    $expectedVersion: Int!
    $title: String
    $bodyBag: ArtimentBodyBagInput
    $communityTags: [ID]
  ) {
    updateBlog(
      article: $article
      commandId: $commandId
      expectedVersion: $expectedVersion
      title: $title
      bodyBag: $bodyBag
      communityTags: $communityTags
    ) {
      innerId
      title
    }
  }
`)

const createChangelog = graphql(`
  mutation CreateChangelogFromPublisher(
    $title: String!
    $bodyBag: ArtimentBodyBagInput!
    $community: String!
    $commandId: ID!
    $communityTags: [ID]
  ) {
    createChangelog(
      title: $title
      bodyBag: $bodyBag
      community: $community
      commandId: $commandId
      communityTags: $communityTags
    ) {
      innerId
      title
    }
  }
`)

const updateChangelog = graphql(`
  mutation UpdateChangelogFromPublisher(
    $article: ArticlePathInput!
    $commandId: ID!
    $expectedVersion: Int!
    $title: String
    $bodyBag: ArtimentBodyBagInput
    $communityTags: [ID]
  ) {
    updateChangelog(
      article: $article
      commandId: $commandId
      expectedVersion: $expectedVersion
      title: $title
      bodyBag: $bodyBag
      communityTags: $communityTags
    ) {
      innerId
      title
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
      }
      body {
        json
      }
    }
  }
`)

export default {
  post,
  createBlog,
  createChangelog,
  updatePost,
  updateBlog,
  updateChangelog,
  createPost,
  community,
}
