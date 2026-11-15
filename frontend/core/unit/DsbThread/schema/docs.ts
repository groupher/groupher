import { graphql } from '~/graphql/authoring'

export const docsPostPublishConflict = graphql(`
  query DocsPostPublishConflict($community: String!, $articleId: ID!) {
    docsPostPublishConflict(community: $community, articleId: $articleId) {
      publicSnapshotId
      workingCopyId
      defaultRevision
    }
  }
`)

export const resolveDocsPostPublish = graphql(`
  mutation ResolveDocsPostPublish(
    $community: String!
    $articleId: ID!
    $workingCopyId: ID!
    $defaultRevision: Int!
    $publicSnapshotId: ID!
    $choices: [DocsMergeChoiceInput!]!
    $commandId: ID!
  ) {
    resolveDocsPostPublish(
      community: $community
      articleId: $articleId
      workingCopyId: $workingCopyId
      defaultRevision: $defaultRevision
      publicSnapshotId: $publicSnapshotId
      choices: $choices
      commandId: $commandId
    ) {
      workingCopyRevision
      conflictFields
    }
  }
`)

export const saveDocsQueueCopy = graphql(`
  mutation SaveDocsQueueCopy(
    $community: String!
    $articleId: ID!
    $queueRevision: Int!
    $workingCopyRevision: Int!
    $title: String!
    $subtitle: String!
    $slug: String!
    $bodyBag: ArtimentBodyBagInput!
    $commandId: ID!
  ) {
    saveDocsQueueCopy(
      community: $community
      articleId: $articleId
      queueRevision: $queueRevision
      workingCopyRevision: $workingCopyRevision
      title: $title
      subtitle: $subtitle
      slug: $slug
      bodyBag: $bodyBag
      commandId: $commandId
    ) {
      queueRevision
      workingCopyRevision
    }
  }
`)

export const mergeDocsQueueCopy = graphql(`
  mutation MergeDocsQueueCopy(
    $community: String!
    $articleId: ID!
    $queueRevision: Int!
    $defaultRevision: Int!
    $workingCopyRevision: Int!
    $choices: [DocsMergeChoiceInput!]!
    $commandId: ID!
  ) {
    mergeDocsQueueCopy(
      community: $community
      articleId: $articleId
      queueRevision: $queueRevision
      defaultRevision: $defaultRevision
      workingCopyRevision: $workingCopyRevision
      choices: $choices
      commandId: $commandId
    ) {
      queueRevision
      workingCopyRevision
      conflict {
        fields
        queueRevision
        defaultRevision
        workingCopyRevision
      }
    }
  }
`)

export const docsWorkspaceTree = graphql(`
  query DocsWorkspaceTree($community: String!) {
    docsWorkspaceTree(community: $community) {
      treeRevision
      queueRevision
      nodes {
        nodeId
        type
        parentNodeId
        index
        title
        href
        docId
        marker
        badge
        hidden
        published
        workingCopyId
        workingCopyRevision
      }
    }
  }
`)

export const docsEditor = graphql(`
  query DocsEditor($community: String!, $articleId: ID!) {
    docsEditor(community: $community, articleId: $articleId) {
      workingCopy {
        id
        articleId
        scopeType
        revision
        title
        slug
        bodyJson
        threadFields
        insertedAt
        updatedAt
      }
      publicSnapshot {
        id
        articleId
        title
        slug
        bodyJson
        threadFields
      }
    }
  }
`)

export const beginDocsEdit = graphql(`
  mutation BeginDocsEdit(
    $community: String!
    $articleId: ID!
    $publicSnapshotId: ID!
    $commandId: ID!
  ) {
    beginDocsEdit(
      community: $community
      articleId: $articleId
      publicSnapshotId: $publicSnapshotId
      commandId: $commandId
    ) {
      workingCopyId
      revision
    }
  }
`)

export const docsWorkingCopies = graphql(`
  query DocsWorkingCopies($community: String!, $articleId: ID!) {
    articleWorkingCopies(community: $community, articleId: $articleId) {
      id
      articleId
      scopeType
      revision
      title
      slug
      digest
      bodyJson
      threadFields
      insertedAt
      updatedAt
    }
  }
`)

export const duplicateDocsWorkspaceNode = graphql(`
  mutation DuplicateDocsWorkspaceNode(
    $community: String!
    $commandId: ID!
    $treeRevision: Int!
    $nodeId: ID!
  ) {
    duplicateDocsWorkspaceNode(
      community: $community
      commandId: $commandId
      treeRevision: $treeRevision
      nodeId: $nodeId
    ) {
      nodeId
      articleId
      workingCopyId
      treeRevision
    }
  }
`)

export const createDocsWorkspaceNode = graphql(`
  mutation CreateDocsWorkspaceNode(
    $community: String!
    $commandId: ID!
    $treeRevision: Int!
    $parentNodeId: ID
    $input: DocsWorkspaceNodeInput!
  ) {
    createDocsWorkspaceNode(
      community: $community
      commandId: $commandId
      treeRevision: $treeRevision
      parentNodeId: $parentNodeId
      input: $input
    ) {
      nodeId
      articleId
      workingCopyId
      treeRevision
    }
  }
`)

export const updateDocsWorkspaceNode = graphql(`
  mutation UpdateDocsWorkspaceNode(
    $community: String!
    $commandId: ID!
    $treeRevision: Int!
    $nodeId: ID!
    $patch: DocsWorkspaceNodePatchInput!
  ) {
    updateDocsWorkspaceNode(
      community: $community
      commandId: $commandId
      treeRevision: $treeRevision
      nodeId: $nodeId
      patch: $patch
    ) {
      treeRevision
    }
  }
`)

export const moveDocsWorkspaceNode = graphql(`
  mutation MoveDocsWorkspaceNode(
    $community: String!
    $commandId: ID!
    $treeRevision: Int!
    $nodeId: ID!
    $parentNodeId: ID
    $position: Int!
  ) {
    moveDocsWorkspaceNode(
      community: $community
      commandId: $commandId
      treeRevision: $treeRevision
      nodeId: $nodeId
      parentNodeId: $parentNodeId
      position: $position
    ) {
      treeRevision
    }
  }
`)

export const docsWorkspaceDeletePreview = graphql(`
  query DocsWorkspaceDeletePreview(
    $community: String!
    $treeRevision: Int!
    $queueRevision: Int!
    $nodeId: ID!
  ) {
    docsWorkspaceDeletePreview(
      community: $community
      treeRevision: $treeRevision
      queueRevision: $queueRevision
      nodeId: $nodeId
    ) {
      requiresConfirmation
      publicCount
      draftCount
      confirmation {
        formatVersion
        hash
      }
      documents {
        articleId
        exclusiveFields
      }
    }
  }
`)

export const deleteDocsWorkspaceNode = graphql(`
  mutation DeleteDocsWorkspaceNode(
    $community: String!
    $commandId: ID!
    $treeRevision: Int!
    $queueRevision: Int!
    $nodeId: ID!
    $confirmation: DocsDiscardConfirmationInput
  ) {
    deleteDocsWorkspaceNode(
      community: $community
      commandId: $commandId
      treeRevision: $treeRevision
      queueRevision: $queueRevision
      nodeId: $nodeId
      confirmation: $confirmation
    ) {
      trashActionId
      treeRevision
      queueRevision
    }
  }
`)

export const restoreDocsWorkspaceNode = graphql(`
  mutation RestoreDocsWorkspaceNode(
    $community: String!
    $commandId: ID!
    $treeRevision: Int!
    $queueRevision: Int!
    $trashActionId: ID!
    $targetParentNodeId: ID
    $targetIndex: Int
  ) {
    restoreDocsWorkspaceNode(
      community: $community
      commandId: $commandId
      treeRevision: $treeRevision
      queueRevision: $queueRevision
      trashActionId: $trashActionId
      targetParentNodeId: $targetParentNodeId
      targetIndex: $targetIndex
    ) {
      nodeId
      treeRevision
      queueRevision
    }
  }
`)

export const purgeDocsWorkspaceTrash = graphql(`
  mutation PurgeDocsWorkspaceTrash(
    $community: String!
    $commandId: ID!
    $queueRevision: Int!
    $trashActionId: ID!
  ) {
    purgeDocsWorkspaceTrash(
      community: $community
      commandId: $commandId
      queueRevision: $queueRevision
      trashActionId: $trashActionId
    ) {
      done
    }
  }
`)

export const enqueueDocs = graphql(`
  mutation EnqueueDocs(
    $community: String!
    $commandId: ID!
    $queueRevision: Int!
    $entries: [DocsQueueEntryInput!]!
  ) {
    enqueueDocs(
      community: $community
      commandId: $commandId
      queueRevision: $queueRevision
      entries: $entries
    ) {
      queueRevision
    }
  }
`)

export const docsDequeuePreview = graphql(`
  query DocsDequeuePreview($community: String!, $queueRevision: Int!, $articleIds: [ID!]!) {
    docsDequeuePreview(
      community: $community
      queueRevision: $queueRevision
      articleIds: $articleIds
    ) {
      requiresConfirmation
      confirmation {
        formatVersion
        hash
      }
      documents {
        articleId
        exclusiveFields
      }
    }
  }
`)

export const dequeueDocs = graphql(`
  mutation DequeueDocs(
    $community: String!
    $commandId: ID!
    $queueRevision: Int!
    $articleIds: [ID!]!
    $confirmation: DocsDiscardConfirmationInput
  ) {
    dequeueDocs(
      community: $community
      commandId: $commandId
      queueRevision: $queueRevision
      articleIds: $articleIds
      confirmation: $confirmation
    ) {
      queueRevision
    }
  }
`)

export const docsPublishQueue = graphql(`
  query DocsPublishQueue($community: String!) {
    docsPublishQueue(community: $community) {
      revision
      approvalRequired
      allowSelfApproval
      approvalPolicyRevision
      approvalStatus
      articles {
        articleId
        workingCopyId
        revision
        title
      }
      treeChanges {
        nodeId
        changeType
        target
      }
    }
  }
`)

export const releaseDocsQueue = graphql(`
  mutation ReleaseDocsQueue($community: String!, $commandId: ID!, $queueRevision: Int!) {
    releaseDocsQueue(community: $community, commandId: $commandId, queueRevision: $queueRevision) {
      releaseId
      queueRevision
    }
  }
`)

export const docTreeTrashItems = graphql(`
  query docTreeTrashItems($community: String!, $pagi: PagiInput) {
    docTreeTrashItems(community: $community, pagi: $pagi) {
      entries {
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
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
        ... on CursorPageInfo {
          startCursor
          endCursor
        }
      }
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
  docsPostPublishConflict,
  resolveDocsPostPublish,
  saveDocsQueueCopy,
  mergeDocsQueueCopy,
  docsWorkspaceTree,
  docsWorkingCopies,
  docsEditor,
  beginDocsEdit,
  duplicateDocsWorkspaceNode,
  createDocsWorkspaceNode,
  updateDocsWorkspaceNode,
  moveDocsWorkspaceNode,
  docsWorkspaceDeletePreview,
  deleteDocsWorkspaceNode,
  restoreDocsWorkspaceNode,
  purgeDocsWorkspaceTrash,
  enqueueDocs,
  docsDequeuePreview,
  dequeueDocs,
  docsPublishQueue,
  releaseDocsQueue,
  docTreeTrashItems,
  addDocCoverCard,
  removeDocCoverCard,
  reorderDocCoverCards,
  pinDocToCover,
  unpinDocFromCover,
  reorderDocCoverPinnedDocs,
  updateDocCoverCardAppearance,
  updatePinnedDocAppearance,
}
