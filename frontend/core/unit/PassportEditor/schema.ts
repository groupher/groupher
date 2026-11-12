import { graphql } from '~/graphql/authoring'

const userPassport = graphql(`
  "Get user by login"
  query UserPassport($login: String!) {
    user(login: $login) {
      passportString
      social {
        github
        twitter
        zhihu
      }
    }
  }
`)

const allPassportRules = graphql(`
  "Get all passport rules include system and community etc ..."
  query AllPassportRules {
    allPassportRulesString {
      cms
    }
  }
`)

const updateModeratorPassport = graphql(`
  "Update cms moderator's title, passport is not effected"
  mutation UpdateModeratorPassport(
    $commandId: ID!
    $community: String!
    $user: String!
    $rules: Json!
  ) {
    updateModeratorPassport(
      commandId: $commandId
      community: $community
      user: $user
      rules: $rules
    ) {
      slug
    }
  }
`)

const removeModerator = graphql(`
  "Unset a moderator from a community, the user's passport also deleted"
  mutation RemoveModerator($commandId: ID!, $community: String!, $user: String!) {
    removeModerator(commandId: $commandId, community: $community, user: $user) {
      slug
    }
  }
`)

const schema = {
  userPassport,
  allPassportRules,
  updateModeratorPassport,
  removeModerator,
}

export default schema
