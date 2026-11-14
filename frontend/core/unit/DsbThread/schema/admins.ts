import { graphql } from '~/graphql/authoring'

export const moderatorPage = graphql(`
  "Paged subscribers of a community"
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

export const userPassport = graphql(`
  "Get user by login"
  query DashboardUserPassport($login: String!) {
    user(login: $login) {
      passportString
    }
  }
`)

export const searchUsers = graphql(`
  "Bounded user picker excluding current moderators"
  query DashboardSearchUsers($name: String!, $community: String!) {
    moderatorCandidates(name: $name, community: $community) {
      login
      avatar
      nickname
      bio
      social {
        github
        twitter
        zhihu
      }
    }
  }
`)

export const addModerator = graphql(`
  "Add a moderator for a community"
  mutation DashboardAddModerator($commandId: ID!, $community: String!, $user: String!) {
    addModerator(commandId: $commandId, community: $community, user: $user) {
      slug
    }
  }
`)

export const addModerators = graphql(`
  "Add moderators for a community"
  mutation DashboardAddModerators($commandId: ID!, $community: String!, $users: [String!]!) {
    addModerators(commandId: $commandId, community: $community, users: $users) {
      slug
    }
  }
`)

export default {
  moderatorPage,
  userPassport,
  searchUsers,
  addModerator,
  addModerators,
}
