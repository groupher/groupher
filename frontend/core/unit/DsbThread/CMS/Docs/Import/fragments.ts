import { graphql } from '~/graphql/authoring'

export const ContentImportJobFields = graphql(`
  fragment ContentImportJobFields on ContentImportJob {
    id
    status
    progress
    process {
      state
      stage
      progress {
        completed
        total
        unit
      }
      recentBatch {
        ref
        label
        state
      }
      updatedAt
    }
    errorCode
    errorMessage
    failedItems
    skipped
    targetBranch
    firstImportedDocRef
    sourceInfo {
      repo
      repoUrl
      branch
      commit
      framework
      contentRoot
      configPaths
    }
    counts {
      tabs
      groups
      pages
      links
      assets
    }
    tree
    badSmells
  }
`)
