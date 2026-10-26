import { graphql } from '~/graphql/authoring'

export const UserAuthorFields = graphql(`
  fragment UserAuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const UserSocialFields = graphql(`
  fragment UserSocialFields on SocialMap {
    github
    twitter
    company
    blog
  }
`)

export const UserAchievementFields = graphql(`
  fragment UserAchievementFields on Achievement {
    reputation
    articlesUpvotesCount
    articlesCollectsCount
  }
`)
