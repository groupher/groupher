import { graphql } from '~/graphql/authoring'

export const updateModerators = graphql(`
  query DashboardCommunityModerators($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      moderators {
        isRoot
        passportItemCount
        user {
          login
          avatar
          nickname
          bio
        }
      }
    }
  }
`)

export const userPassport = graphql(`
  query DashboardUserPassport($login: String!) {
    user(login: $login) {
      passportString
    }
  }
`)

export const searchUsers = graphql(`
  query DashboardSearchUsers($name: String!) {
    searchUsers(name: $name) {
      entries {
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
  }
`)

export const addModerator = graphql(`
  mutation DashboardAddModerator($community: String!, $user: String!) {
    addModerator(community: $community, user: $user) {
      moderators {
        isRoot
        passportItemCount
        user {
          login
          avatar
          nickname
          bio
        }
      }
    }
  }
`)

export const addModerators = graphql(`
  mutation DashboardAddModerators($community: String!, $users: [String!]!) {
    addModerators(community: $community, users: $users) {
      moderators {
        isRoot
        passportItemCount
        user {
          login
          avatar
          nickname
          bio
        }
      }
    }
  }
`)

export default { updateModerators, userPassport, searchUsers, addModerator, addModerators }
