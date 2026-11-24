import { graphql } from '~/graphql/authoring'

const job = graphql(`
  query ContentImportJob($community: String!, $jobRef: ID!) {
    contentImportJob(community: $community, jobRef: $jobRef) {
      ...ContentImportJobFields
    }
  }
`)

export default { job }
