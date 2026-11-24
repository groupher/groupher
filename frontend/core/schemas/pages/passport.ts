import { graphql } from '~/graphql/authoring'

/** Current viewer Passport facts used for conservative, early UI admission decisions. */
export const currentGlobalPassport = graphql(`
  query CurrentGlobalPassport {
    currentGlobalPassport {
      isRoot
      permissions
    }
  }
`)

/** Current Community membership facts for revision-bound membership actions. */
export const currentCommunityAdmin = graphql(`
  query CurrentCommunityAdmin($communityRef: String!) {
    currentCommunityAdmin(communityRef: $communityRef) {
      memberId
      revision
      isLord
      permissions
    }
  }
`)

/** Minimal current Community authorization facts for early UI admission decisions. */
export const currentCommunityGateFacts = graphql(`
  query CurrentCommunityGateFacts($communityRef: String!) {
    currentCommunityAdmin(communityRef: $communityRef) {
      isLord
      permissions
    }
  }
`)
