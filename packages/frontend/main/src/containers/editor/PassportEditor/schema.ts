import { gql } from 'urql'

const userPassport = gql`
  query ($login: String) {
    user(login: $login) {
      cmsPassportString
    }
  }
`

const allPassportRules = gql`
  query {
    allPassportRules {
      root
      moderator
    }
  }
`

const updateModeratorPassport = gql`
  mutation ($community: String!, $user: String!, $rules: Json!) {
    updateModeratorPassport(community: $community, user: $user, rules: $rules) {
      slug
    }
  }
`

const schema = {
  userPassport,
  allPassportRules,
  updateModeratorPassport,
}

export default schema
