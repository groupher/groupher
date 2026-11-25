import { graphql } from '~/graphql/authoring'

export const createArticle = graphql(`
  "Create a stable Article and its default mutable WorkingCopy"
  mutation CreateArticle(
    $community: String!
    $thread: Thread!
    $commandId: ID!
    $title: String
    $digest: String
    $slug: String
    $bodyBag: ArtimentBodyBagInput!
    $tagIds: [ID]
    $copyRight: String
    $linkAddr: String
    $subtitle: String
    $templateKey: String
    $coverUrl: String
    $coverUrlDark: String
  ) {
    createArticle(
      community: $community
      thread: $thread
      commandId: $commandId
      title: $title
      digest: $digest
      slug: $slug
      bodyBag: $bodyBag
      tagIds: $tagIds
      copyRight: $copyRight
      linkAddr: $linkAddr
      subtitle: $subtitle
      templateKey: $templateKey
      coverUrl: $coverUrl
      coverUrlDark: $coverUrlDark
    ) {
      id
      articleId
      scopeType
      scopeId
      revision
      title
      digest
      slug
      bodyJson
      bodyMarkdown
      bodyHtml
      bodyMarkdownToc
      bodyPlainText
      bodyThumbnail
      tagIds
      threadFields
    }
  }
`)

export const createAndPublishArticle = graphql(`
  "Create and publish an Article atomically through one command and Receipt"
  mutation CreateAndPublishArticle(
    $community: String!
    $thread: Thread!
    $commandId: ID!
    $title: String
    $digest: String
    $slug: String
    $bodyBag: ArtimentBodyBagInput!
    $tagIds: [ID]
    $copyRight: String
    $linkAddr: String
    $subtitle: String
    $templateKey: String
    $coverUrl: String
    $coverUrlDark: String
  ) {
    createAndPublishArticle(
      community: $community
      thread: $thread
      commandId: $commandId
      title: $title
      digest: $digest
      slug: $slug
      bodyBag: $bodyBag
      tagIds: $tagIds
      copyRight: $copyRight
      linkAddr: $linkAddr
      subtitle: $subtitle
      templateKey: $templateKey
      coverUrl: $coverUrl
      coverUrlDark: $coverUrlDark
    ) {
      articleId
      snapshotId
      publishedAt
      publishedById
      title
      digest
      slug
      plainText
      thumbnail
    }
  }
`)

export const saveWorkingCopy = graphql(`
  "Save one Article WorkingCopy patch at its current revision"
  mutation SaveWorkingCopy(
    $articleId: ID!
    $workingCopyId: ID!
    $community: String!
    $commandId: ID!
    $revision: Int!
    $title: String
    $digest: String
    $slug: String
    $bodyBag: ArtimentBodyBagInput!
    $tagIds: [ID]
    $copyRight: String
    $linkAddr: String
    $subtitle: String
    $templateKey: String
    $coverUrl: String
    $coverUrlDark: String
  ) {
    saveWorkingCopy(
      articleId: $articleId
      workingCopyId: $workingCopyId
      community: $community
      commandId: $commandId
      revision: $revision
      title: $title
      digest: $digest
      slug: $slug
      bodyBag: $bodyBag
      tagIds: $tagIds
      copyRight: $copyRight
      linkAddr: $linkAddr
      subtitle: $subtitle
      templateKey: $templateKey
      coverUrl: $coverUrl
      coverUrlDark: $coverUrlDark
    ) {
      id
      articleId
      scopeType
      scopeId
      revision
      title
      digest
      slug
      bodyJson
      bodyMarkdown
      bodyHtml
      bodyMarkdownToc
      bodyPlainText
      bodyThumbnail
      tagIds
      threadFields
    }
  }
`)
