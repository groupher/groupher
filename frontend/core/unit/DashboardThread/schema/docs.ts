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

export const docDraftSnapshots = graphql(`
  query docDraftSnapshots($community: String!, $id: ID!, $stage: ArticleSnapshotStage) {
    docDraftSnapshots(community: $community, id: $id, stage: $stage) {
      id
      thread
      stage
      action
      articleHashId
      title
      slug
      subtitle
      digest
      documentJson
      versionHash
      revisionNumber
      schemaVersion
      insertedAt
      author {
        login
        nickname
        avatar
      }
    }
  }
`)

export const createDocTreeNode = graphql(`
  mutation CreateDocTreeNode(
    $community: String!
    $baseRevision: Int!
    $parentNodeId: ID
    $input: DocTreeNodeInput!
  ) {
    createDocTreeNode(
      community: $community
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
    $baseRevision: Int!
    $patch: DocTreeNodePatchInput!
  ) {
    updateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision, patch: $patch) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const updateDocDraft = graphql(`
  mutation UpdateDocDraft(
    $community: String!
    $id: ID!
    $title: String
    $subtitle: String
    $slug: String
    $bodyBag: ArtimentBodyBagInput
  ) {
    updateDocDraft(
      community: $community
      id: $id
      title: $title
      subtitle: $subtitle
      slug: $slug
      bodyBag: $bodyBag
    ) {
      id
      docId
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

export const checkpointDocDraftSnapshot = graphql(`
  mutation checkpointDocDraftSnapshot($community: String!, $id: ID!) {
    checkpointDocDraftSnapshot(community: $community, id: $id) {
      id
      thread
      stage
      action
      articleHashId
      title
      slug
      subtitle
      documentJson
      digest
      versionHash
      revisionNumber
      schemaVersion
      insertedAt
      author {
        login
        nickname
        avatar
      }
    }
  }
`)

export const publishDocChanges = graphql(`
  mutation publishDocChanges(
    $community: String!
    $input: DocPublishChangesInput
    $mode: DocPublishMode
  ) {
    publishDocChanges(community: $community, input: $input, mode: $mode) {
      done
      release {
        id
        releaseNumber
        publishedAt
      }
      checklist {
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
  mutation moveDocToDraft($community: String!, $id: ID!) {
    moveDocToDraft(community: $community, id: $id) {
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
  mutation moveDocTreeSubtreeToDraft($community: String!, $nodeId: ID!) {
    moveDocTreeSubtreeToDraft(community: $community, nodeId: $nodeId) {
      done
    }
  }
`)

export const restoreDocDraftSnapshot = graphql(`
  mutation restoreDocDraftSnapshot($community: String!, $id: ID!, $snapshotId: ID!) {
    restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {
      id
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

export const deleteDocTreeNode = graphql(`
  mutation DeleteDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {
    deleteDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const restoreDocTreeTrashItem = graphql(`
  mutation RestoreDocTreeTrashItem(
    $community: String!
    $id: ID!
    $baseRevision: Int!
    $targetParentNodeId: ID
    $targetIndex: Int
  ) {
    restoreDocTreeTrashItem(
      community: $community
      id: $id
      baseRevision: $baseRevision
      targetParentNodeId: $targetParentNodeId
      targetIndex: $targetIndex
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const duplicateDocTreeNode = graphql(`
  mutation DuplicateDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {
    duplicateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const moveDocTreeNode = graphql(`
  mutation MoveDocTreeNode(
    $community: String!
    $id: ID!
    $baseRevision: Int!
    $targetParentNodeId: ID
    $targetIndex: Int
  ) {
    moveDocTreeNode(
      community: $community
      id: $id
      baseRevision: $baseRevision
      targetParentNodeId: $targetParentNodeId
      targetIndex: $targetIndex
    ) {
      ...DashboardDocTreeMutationPayload
    }
  }
`)

export const addDocCoverCard = graphql(`
  mutation addDocCoverCard($community: String!, $groupNodeId: ID!) {
    addDocCoverCard(community: $community, groupNodeId: $groupNodeId) {
      id
      index
      appearance
    }
  }
`)

export const removeDocCoverCard = graphql(`
  mutation removeDocCoverCard($community: String!, $groupNodeId: ID!) {
    removeDocCoverCard(community: $community, groupNodeId: $groupNodeId) {
      id
      index
      appearance
    }
  }
`)

export const reorderDocCoverCards = graphql(`
  mutation reorderDocCoverCards($community: String!, $ids: [ID!]!) {
    reorderDocCoverCards(community: $community, ids: $ids) {
      done
    }
  }
`)

export const pinDocToCover = graphql(`
  mutation pinDocToCover($community: String!, $nodeId: ID!) {
    pinDocToCover(community: $community, nodeId: $nodeId) {
      nodeId
      index
      appearance
    }
  }
`)

export const unpinDocFromCover = graphql(`
  mutation unpinDocFromCover($community: String!, $nodeId: ID!) {
    unpinDocFromCover(community: $community, nodeId: $nodeId) {
      nodeId
    }
  }
`)

export const reorderDocCoverPinnedDocs = graphql(`
  mutation reorderDocCoverPinnedDocs($community: String!, $nodeIds: [ID!]!) {
    reorderDocCoverPinnedDocs(community: $community, nodeIds: $nodeIds) {
      done
    }
  }
`)

export const updateDocCoverCardAppearance = graphql(`
  mutation updateDocCoverCardAppearance($community: String!, $id: ID!, $appearance: Json!) {
    updateDocCoverCardAppearance(community: $community, id: $id, appearance: $appearance) {
      id
      appearance
    }
  }
`)

export const updatePinnedDocAppearance = graphql(`
  mutation updatePinnedDocAppearance($community: String!, $nodeId: ID!, $appearance: Json!) {
    updatePinnedDocAppearance(community: $community, nodeId: $nodeId, appearance: $appearance) {
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
  docDraftSnapshots,
  createDocTreeNode,
  updateDocTreeNode,
  updateDocDraft,
  checkpointDocDraftSnapshot,
  publishDocChanges,
  moveDocToDraft,
  moveDocTreeSubtreeToDraft,
  restoreDocDraftSnapshot,
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
