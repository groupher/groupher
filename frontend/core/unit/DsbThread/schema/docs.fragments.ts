import { graphql } from '~/graphql/authoring'

export const DashboardDocTreeNodeFields = graphql(`
  fragment DashboardDocTreeNodeFields on DocTreeNode {
    id
    parentNodeId
    docId
    type
    title
    index
    href
    marker {
      type
      provider
      name
      src
      unified
      appearance {
        light {
          color
          bg
        }
        dark {
          color
          bg
        }
      }
    }
    badge
    hidden
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
`)

export const DashboardDocTreeChildFields = graphql(`
  fragment DashboardDocTreeChildFields on DocTreeNode {
    ...DashboardDocTreeNodeFields
    pages {
      ...DashboardDocTreeNodeFields
    }
  }
`)

export const DashboardDocTreeGroupFields = graphql(`
  fragment DashboardDocTreeGroupFields on DocTreeNode {
    ...DashboardDocTreeNodeFields
    pages {
      ...DashboardDocTreeChildFields
    }
  }
`)

export const DashboardDocPublishChecklistItemFields = graphql(`
  fragment DashboardDocPublishChecklistItemFields on DocPublishChecklistItem {
    id
    title
    action
    selectedByDefault
    selectable
    disabledReason
  }
`)

export const DashboardDocTreeMutationPayload = graphql(`
  fragment DashboardDocTreeMutationPayload on DocTreeMutationPayload {
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
    conflict
    node {
      ...DashboardDocTreeNodeFields
    }
    affectedNodes {
      ...DashboardDocTreeNodeFields
    }
  }
`)
