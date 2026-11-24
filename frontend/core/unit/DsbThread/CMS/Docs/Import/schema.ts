import { graphql } from '~/graphql/authoring'

const job = graphql(`
  query ImportJob($community: String!, $jobRef: ID!) {
    importJob(community: $community, jobRef: $jobRef) {
      ...ImportJobFields
    }
  }
`)

export default { job }
