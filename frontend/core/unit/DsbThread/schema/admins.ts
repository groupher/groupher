import { graphql } from '~/graphql/authoring'

/** Public community member listing; does not expose the legacy Passport string. */
export const moderatorPage = graphql(`
  query PagedCommunityModerators($community: String!, $pagi: PagiInput) {
    pagedCommunityModerators(community: $community, pagi: $pagi) {
      entries {
        id
        isRoot
        passportItemCount
        user {
          login
          avatar
          nickname
          bio
        }
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

export const adminPage = graphql(`
  "Paged Community Admin memberships"
  query DashboardPagedCommunityAdmins($communityRef: String!, $pagi: PagiInput) {
    pagedCommunityAdmins(communityRef: $communityRef, pagi: $pagi) {
      entries {
        memberId
        revision
        isLord
        permissions
        user {
          login
          avatar
          nickname
          bio
        }
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

export const adminRequests = graphql(`
  "Paged Community Admin requests visible to the current user"
  query DashboardPagedCommunityAdminRequests($communityRef: String!, $pagi: PagiInput) {
    pagedCommunityAdminRequests(communityRef: $communityRef, pagi: $pagi) {
      entries {
        id
        type
        status
        decision
        revision
        proposedPermissions
        approvedPermissions
        expiresAt
        subjectUser {
          login
          nickname
          avatar
        }
        createdBy {
          login
          nickname
          avatar
        }
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

export const currentAdmin = graphql(`
  "Current viewer's Community Admin membership"
  query DashboardCurrentCommunityAdmin($communityRef: String!) {
    currentCommunityAdmin(communityRef: $communityRef) {
      memberId
      revision
      isLord
      permissions
      user {
        login
      }
    }
  }
`)

export const searchUsers = graphql(`
  "Bounded user picker excluding current Admins and pending requests"
  query DashboardAdminCandidates($name: String!, $communityRef: String!) {
    adminCandidates(name: $name, communityRef: $communityRef) {
      ...UserSearchFields
    }
  }
`)

export const createAdminRequest = graphql(`
  "Create a Community Admin invitation or application"
  mutation DashboardCreateCommunityAdminRequest(
    $commandId: ID!
    $communityRef: String!
    $type: String!
    $subjectLogin: String
    $permissions: Json!
  ) {
    createCommunityAdminRequest(
      commandId: $commandId
      communityRef: $communityRef
      type: $type
      subjectLogin: $subjectLogin
      permissions: $permissions
    ) {
      id
      revision
      status
    }
  }
`)

export const decideAdminRequest = graphql(`
  "Accept or reject a Community Admin request"
  mutation DashboardDecideCommunityAdminRequest(
    $commandId: ID!
    $requestId: ID!
    $revision: Int!
    $decision: String!
    $approvedPermissions: Json
  ) {
    decideCommunityAdminRequest(
      commandId: $commandId
      requestId: $requestId
      revision: $revision
      decision: $decision
      approvedPermissions: $approvedPermissions
    ) {
      id
      revision
      status
    }
  }
`)

export const cancelAdminRequest = graphql(`
  "Cancel a Community Admin request at its current revision"
  mutation DashboardCancelCommunityAdminRequest($commandId: ID!, $requestId: ID!, $revision: Int!) {
    cancelCommunityAdminRequest(commandId: $commandId, requestId: $requestId, revision: $revision) {
      id
      revision
      status
    }
  }
`)

export const updateAdminPermissions = graphql(`
  "Replace one Admin's grantable permissions at its current revision"
  mutation DashboardUpdateCommunityAdminPermissions(
    $commandId: ID!
    $communityRef: String!
    $memberId: ID!
    $revision: Int!
    $permissions: Json!
  ) {
    updateCommunityAdminPermissions(
      commandId: $commandId
      communityRef: $communityRef
      memberId: $memberId
      revision: $revision
      permissions: $permissions
    ) {
      memberId
      revision
      isLord
      permissions
      user {
        login
      }
    }
  }
`)

export const removeAdmin = graphql(`
  "Remove one Admin membership at its current revision"
  mutation DashboardRemoveCommunityAdmin(
    $commandId: ID!
    $communityRef: String!
    $memberId: ID!
    $revision: Int!
  ) {
    removeCommunityAdmin(
      commandId: $commandId
      communityRef: $communityRef
      memberId: $memberId
      revision: $revision
    )
  }
`)

export const leaveCommunityAdmins = graphql(`
  "Leave the current user's ordinary Community Admin membership"
  mutation DashboardLeaveCommunityAdmins($commandId: ID!, $communityRef: String!, $revision: Int!) {
    leaveCommunityAdmins(commandId: $commandId, communityRef: $communityRef, revision: $revision)
  }
`)

export default {
  moderatorPage,
  adminPage,
  adminRequests,
  currentAdmin,
  searchUsers,
  createAdminRequest,
  decideAdminRequest,
  cancelAdminRequest,
  updateAdminPermissions,
  removeAdmin,
  leaveCommunityAdmins,
}
