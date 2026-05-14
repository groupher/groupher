import { gql } from 'urql'

const userPassport = gql`
  query ($login: String!) {
    user(login: $login) {
      cmsPassportString
      social {
        github
        twitter
        zhihu
      }
    }
  }
`

const allPassportRules = gql`
  query {
    allPassportRulesString {
      cms
    }
  }
`

const updateModeratorPassport = gql`
  mutation ($community: String!, $user: String!, $rules: Json!) {
    updateModeratorPassport(community: $community, user: $user, rules: $rules) {
      slug
      moderators {
        role
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
`

const removeModerator = gql`
  mutation ($community: String!, $user: String!) {
    removeModerator(community: $community, user: $user) {
      slug
      moderators {
        role
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
`

const schema = {
  userPassport,
  allPassportRules,
  updateModeratorPassport,
  removeModerator,
}

export default schema
