import { graphql } from '~/graphql/authoring'

export const preview = graphql(`
  query DocsQueuePreview($community: String!, $articleId: ID, $versions: Json) {
    docsQueuePreview(community: $community, articleId: $articleId, versions: $versions)
  }
`)
export const diff = graphql(`
  query DocsApprovalDiff(
    $community: String!
    $articleId: ID
    $versions: Json
    $baseline: DocsDiffBaseline
  ) {
    docsApprovalDiff(
      community: $community
      articleId: $articleId
      versions: $versions
      baseline: $baseline
    )
  }
`)
export const releases = graphql(`
  query DocsReleaseHistory($community: String!, $beforeId: Int) {
    docsReleaseHistory(community: $community, beforeId: $beforeId)
  }
`)
export const release = graphql(`
  query DocsReleaseDetail($community: String!, $releaseId: Int!, $articleId: ID) {
    docsReleaseDetail(community: $community, releaseId: $releaseId, articleId: $articleId)
  }
`)
export const snapshots = graphql(`
  query DocsSnapshotHistory($community: String!, $articleId: ID!, $snapshotId: ID, $cursor: Json) {
    docsSnapshotHistory(
      community: $community
      articleId: $articleId
      snapshotId: $snapshotId
      cursor: $cursor
    )
  }
`)
export const notices = graphql(`
  query DocsPublicationNotices($community: String!) {
    docsPublicationNotices(community: $community)
  }
`)
export const configure = graphql(`
  mutation ConfigureDocsQueue(
    $community: String!
    $approvalPolicyRevision: Int!
    $approvalRequired: Boolean!
    $allowSelfApproval: Boolean!
    $commandId: ID!
  ) {
    configureDocsQueue(
      community: $community
      approvalPolicyRevision: $approvalPolicyRevision
      approvalRequired: $approvalRequired
      allowSelfApproval: $allowSelfApproval
      commandId: $commandId
    )
  }
`)
export const approve = graphql(`
  mutation ApproveDocsQueue($community: String!, $queueRevision: Int!, $commandId: ID!) {
    approveDocsQueue(community: $community, queueRevision: $queueRevision, commandId: $commandId) {
      approvalId
      queueRevision
    }
  }
`)

export const policy = graphql(`
  query DocsQueuePolicy($community: String!) {
    docsQueuePolicy(community: $community)
  }
`)

export const restore = graphql(`
  mutation RestoreDocsSnapshot(
    $community: String!
    $articleId: ID!
    $snapshotId: ID!
    $workingCopyId: ID
    $revision: Int
    $commandId: ID!
  ) {
    restoreDocsSnapshot(
      community: $community
      articleId: $articleId
      snapshotId: $snapshotId
      workingCopyId: $workingCopyId
      revision: $revision
      commandId: $commandId
    ) {
      workingCopyId
      revision
    }
  }
`)
