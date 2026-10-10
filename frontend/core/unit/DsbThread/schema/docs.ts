import { graphql } from '~/graphql/authoring'

export const docTree = graphql(`
  query DashboardDocTree($community: String!) {
    docTree(community: $community) {
      revision
      treeState {
        hasUnpublishedChanges
        stagedEventCount
        baseSnapshotId
        latestSnapshotId
        latestReleaseId
        latestReleaseNumber
        revision
      }
      stagedEvents {
        id
        seq
        eventType
        payload
        inversePayload
        status
        insertedAt
      }
      tabs {
        ...DashboardDocTreeNodeFields
        pins {
          ...DashboardDocTreeNodeFields
        }
        groups {
          ...DashboardDocTreeGroupFields
        }
      }
    }
  }
`)

export const docPublishChecklist = graphql(`
  query DashboardDocPublishChecklist($community: String!) {
    docPublishChecklist(community: $community) {
      revision
      totalCount
      docChanges {
        ...DashboardDocPublishChecklistItemFields
      }
      treeChanges {
        ...DashboardDocPublishChecklistItemFields
      }
    }
  }
`)

export const docTreeTrashItems = graphql(`
  query docTreeTrashItems($community: String!) {
    docTreeTrashItems(community: $community) {
      id
      nodeId
      docId
      type
      title
      deletedFromParentNodeId
      deletedFromIndex
      deletedAt
      restoredAt
    }
  }
`)

export const docDraft = graphql(`
  query docDraft($community: String!, $id: ID!) {
    docDraft(community: $community, id: $id) {
      id
      docId
      branchId
      version
      contentHash
      baseRevisionId
      title
      subtitle
      slug
      stage
      digest
      insertedAt
      updatedAt
      author {
        login
        nickname
        avatar
      }
      document {
        json
        markdown
        markdownToc
        html
      }
    }
  }
`)

export const docBranchVersions = graphql(`
  query docBranchVersions($docId: ID!, $branchId: ID!) {
    docBranchVersions(docId: $docId, branchId: $branchId) {
      id
      revisionId
      versionNumber
      publishedAt
      message
      content {
        title
        slug
        subtitle
        digest
        documentJson
        bodyHash
        schemaVersion
      }
    }
  }
`)

export const restoreDocRevisionToDraft = graphql(`
  mutation restoreDocRevisionToDraft(
    $commandId: ID!
    $docId: ID!
    $branchId: ID!
    $revisionId: ID!
    $expectedVersion: Int
  ) {
    restoreDocRevisionToDraft(
      commandId: $commandId
      docId: $docId
      branchId: $branchId
      revisionId: $revisionId
      expectedVersion: $expectedVersion
    ) {
      docId
      branchId
      version
      baseRevisionId
      title
      subtitle
      slug
      document {
        json
      }
    }
  }
`)

export const createDocTreeNode = graphql(`
  mutation CreateDocTreeNode(
    $community: String!
    $commandId: ID!
    $baseRevision: Int!
    $parentNodeId: ID
    $input: DocTreeNodeInput!
  ) {
    createDocTreeNode(
      community: $community
      commandId: $commandId
      baseRevision: $baseRevision
      parentNodeId: $parentNodeId
      input: $input
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const updateDocTreeNode = graphql(`
  mutation UpdateDocTreeNode(
    $community: String!
    $id: ID!
    $commandId: ID!
    $baseRevision: Int!
    $patch: DocTreeNodePatchInput!
  ) {
    updateDocTreeNode(
      community: $community
      id: $id
      commandId: $commandId
      baseRevision: $baseRevision
      patch: $patch
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const updateDocDraft = graphql(`
  mutation UpdateDocDraft(
    $community: String!
    $id: ID!
    $commandId: ID!
    $expectedVersion: Int!
    $title: String
    $subtitle: String
    $slug: String
    $bodyBag: ArtimentBodyBagInput
  ) {
    updateDocDraft(
      community: $community
      id: $id
      commandId: $commandId
      expectedVersion: $expectedVersion
      title: $title
      subtitle: $subtitle
      slug: $slug
      bodyBag: $bodyBag
    ) {
      id
      docId
      version
      title
      subtitle
      slug
      digest
      insertedAt
      updatedAt
      author {
        login
        nickname
        avatar
      }
      document {
        json
        markdown
        markdownToc
        html
      }
    }
  }
`)

export const publishDocChanges = graphql(`
  mutation publishDocChanges(
    $community: String!
    $commandId: ID!
    $input: DocPublishChangesInput
    $mode: DocPublishMode
  ) {
    publishDocChanges(community: $community, commandId: $commandId, input: $input, mode: $mode) {
      done
      release {
        id
        releaseNumber
        publishedAt
      }
      checklist {
        revision
        totalCount
        docChanges {
          ...DashboardDocPublishChecklistItemFields
        }
        treeChanges {
          ...DashboardDocPublishChecklistItemFields
        }
      }
    }
  }
`)

export const moveDocToDraft = graphql(`
  mutation moveDocToDraft($community: String!, $id: ID!, $commandId: ID!) {
    moveDocToDraft(community: $community, id: $id, commandId: $commandId) {
      docId
      stage
      publishState {
        status
        published
        publishedBefore
        hasDraft
        publicNodeId
        publicDocId
        hasUnpublishedChanges
        lastPublishedAt
        inCover
        hiddenFromCover
        pinnedToCover
      }
    }
  }
`)

export const moveDocTreeSubtreeToDraft = graphql(`
  mutation moveDocTreeSubtreeToDraft($community: String!, $nodeId: ID!, $commandId: ID!) {
    moveDocTreeSubtreeToDraft(community: $community, nodeId: $nodeId, commandId: $commandId) {
      done
    }
  }
`)

export const deleteDocTreeNode = graphql(`
  mutation DeleteDocTreeNode($community: String!, $id: ID!, $commandId: ID!, $baseRevision: Int!) {
    deleteDocTreeNode(
      community: $community
      id: $id
      commandId: $commandId
      baseRevision: $baseRevision
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const restoreDocTreeTrashItem = graphql(`
  mutation RestoreDocTreeTrashItem(
    $community: String!
    $id: ID!
    $commandId: ID!
    $baseRevision: Int!
    $targetParentNodeId: ID
    $targetIndex: Int
  ) {
    restoreDocTreeTrashItem(
      community: $community
      id: $id
      commandId: $commandId
      baseRevision: $baseRevision
      targetParentNodeId: $targetParentNodeId
      targetIndex: $targetIndex
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const duplicateDocTreeNode = graphql(`
  mutation DuplicateDocTreeNode(
    $community: String!
    $id: ID!
    $commandId: ID!
    $baseRevision: Int!
  ) {
    duplicateDocTreeNode(
      community: $community
      id: $id
      commandId: $commandId
      baseRevision: $baseRevision
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const moveDocTreeNode = graphql(`
  mutation MoveDocTreeNode(
    $community: String!
    $id: ID!
    $commandId: ID!
    $baseRevision: Int!
    $targetParentNodeId: ID
    $targetIndex: Int
  ) {
    moveDocTreeNode(
      community: $community
      id: $id
      commandId: $commandId
      baseRevision: $baseRevision
      targetParentNodeId: $targetParentNodeId
      targetIndex: $targetIndex
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const addDocCoverCard = graphql(`
  mutation addDocCoverCard($commandId: ID!, $community: String!, $groupNodeId: ID!) {
    addDocCoverCard(commandId: $commandId, community: $community, groupNodeId: $groupNodeId) {
      id
      index
      appearance
    }
  }
`)

export const removeDocCoverCard = graphql(`
  mutation removeDocCoverCard($commandId: ID!, $community: String!, $groupNodeId: ID!) {
    removeDocCoverCard(commandId: $commandId, community: $community, groupNodeId: $groupNodeId) {
      id
      index
      appearance
    }
  }
`)

export const reorderDocCoverCards = graphql(`
  mutation reorderDocCoverCards($commandId: ID!, $community: String!, $ids: [ID!]!) {
    reorderDocCoverCards(commandId: $commandId, community: $community, ids: $ids) {
      done
    }
  }
`)

export const pinDocToCover = graphql(`
  mutation pinDocToCover($commandId: ID!, $community: String!, $nodeId: ID!) {
    pinDocToCover(commandId: $commandId, community: $community, nodeId: $nodeId) {
      nodeId
      index
      appearance
    }
  }
`)

export const unpinDocFromCover = graphql(`
  mutation unpinDocFromCover($commandId: ID!, $community: String!, $nodeId: ID!) {
    unpinDocFromCover(commandId: $commandId, community: $community, nodeId: $nodeId) {
      nodeId
    }
  }
`)

export const reorderDocCoverPinnedDocs = graphql(`
  mutation reorderDocCoverPinnedDocs($commandId: ID!, $community: String!, $nodeIds: [ID!]!) {
    reorderDocCoverPinnedDocs(commandId: $commandId, community: $community, nodeIds: $nodeIds) {
      done
    }
  }
`)

export const updateDocCoverCardAppearance = graphql(`
  mutation updateDocCoverCardAppearance(
    $commandId: ID!
    $community: String!
    $id: ID!
    $appearance: Json!
  ) {
    updateDocCoverCardAppearance(
      commandId: $commandId
      community: $community
      id: $id
      appearance: $appearance
    ) {
      id
      appearance
    }
  }
`)

export const updatePinnedDocAppearance = graphql(`
  mutation updatePinnedDocAppearance(
    $commandId: ID!
    $community: String!
    $nodeId: ID!
    $appearance: Json!
  ) {
    updatePinnedDocAppearance(
      commandId: $commandId
      community: $community
      nodeId: $nodeId
      appearance: $appearance
    ) {
      nodeId
      appearance
    }
  }
`)

export default {
  docTree,
  docPublishChecklist,
  docTreeTrashItems,
  docDraft,
  docBranchVersions,
  createDocTreeNode,
  updateDocTreeNode,
  updateDocDraft,
  publishDocChanges,
  moveDocToDraft,
  moveDocTreeSubtreeToDraft,
  restoreDocRevisionToDraft,
  deleteDocTreeNode,
  restoreDocTreeTrashItem,
  duplicateDocTreeNode,
  moveDocTreeNode,
  addDocCoverCard,
  removeDocCoverCard,
  reorderDocCoverCards,
  pinDocToCover,
  unpinDocFromCover,
  reorderDocCoverPinnedDocs,
  updateDocCoverCardAppearance,
  updatePinnedDocAppearance,
}
