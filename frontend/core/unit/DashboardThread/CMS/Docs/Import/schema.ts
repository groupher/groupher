import { gql } from 'urql'

const jobFields = gql`
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
`

const job = gql`
  ${jobFields}
  query ContentImportJob($community: String!, $jobRef: ID!) {
    contentImportJob(community: $community, jobRef: $jobRef) {
      ...ContentImportJobFields
    }
  }
`

export default { job }
