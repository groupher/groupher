import { graphql } from '~/graphql/authoring'

const createArticle = graphql(`
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

const createAndPublishArticle = graphql(`
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

const saveWorkingCopy = graphql(`
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

const forkSnapshot = graphql(`
  "Create an independent WorkingCopy from an immutable Article Snapshot"
  mutation ForkSnapshot(
    $commandId: ID!
    $snapshotId: ID!
    $community: String!
    $scopeType: String!
    $scopeId: ID!
  ) {
    forkSnapshot(
      commandId: $commandId
      snapshotId: $snapshotId
      community: $community
      scopeType: $scopeType
      scopeId: $scopeId
    ) {
      workingCopy {
        id
        articleId
        scopeType
        scopeId
        revision
        tagIds
        threadFields
        title
      }
    }
  }
`)

const publishArticle = graphql(`
  "Select a saved Article Snapshot as the current public version"
  mutation PublishArticle(
    $commandId: ID!
    $articleId: ID!
    $community: String!
    $source: ArticleWorkingCopySourceInput!
    $expectedPublicSnapshotId: ID
  ) {
    publishArticle(
      commandId: $commandId
      articleId: $articleId
      community: $community
      source: $source
      expectedPublicSnapshotId: $expectedPublicSnapshotId
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

const deleteWorkingCopy = graphql(`
  "Discard one editable WorkingCopy"
  mutation DeleteWorkingCopy(
    $commandId: ID!
    $articleId: ID!
    $workingCopyId: ID!
    $community: String!
  ) {
    deleteWorkingCopy(
      commandId: $commandId
      articleId: $articleId
      workingCopyId: $workingCopyId
      community: $community
    ) {
      done
      commandId
    }
  }
`)

const community = graphql(`
  "Spec community info"
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

const workingCopies = graphql(`
  "Editable WorkingCopies for one Article"
  query ArticleEditorWorkingCopies($articleId: ID!, $community: String!) {
    articleWorkingCopies(articleId: $articleId, community: $community) {
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
      updatedAt
    }
  }
`)

const snapshots = graphql(`
  "Immutable Snapshots for one Article"
  query ArticleEditorSnapshots($articleId: ID!, $community: String!) {
    articleSnapshots(articleId: $articleId, community: $community) {
      id
      articleId
      sourceWorkingCopyId
      sourceRevision
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
      capturedAt
    }
  }
`)

export default {
  workingCopies,
  snapshots,
  createArticle,
  createAndPublishArticle,
  saveWorkingCopy,
  forkSnapshot,
  publishArticle,
  deleteWorkingCopy,
  community,
}
