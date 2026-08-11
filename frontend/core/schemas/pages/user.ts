import { graphql } from '~/graphql/authoring'

export const me = graphql(`
  query Me {
    me {
      login
      nickname
      avatar
      bio
      passport
    }
  }
`)

export const user = graphql(`
  query User($login: String!, $userHasLogin: Boolean!) {
    user(login: $login) {
      ...UserAuthorFields
      views
      sex
      location
      social {
        ...UserSocialFields
      }
      meta {
        isMaker
        publishedPostsCount
        publishedBlogsCount
      }
      followersCount
      followingsCount
      viewerHasFollowed @include(if: $userHasLogin)
      achievement {
        ...UserAchievementFields
      }
      contributes {
        records {
          count
          date
        }
        startDate
        endDate
        totalCount
      }

      subscribedCommunitiesCount

      insertedAt
    }
  }
`)

export const sessionState = graphql(`
  query SessionState {
    sessionState {
      isValid
      user {
        ...UserAuthorFields
        geoCity
        location
        social {
          ...UserSocialFields
        }
        passport
        subscribedCommunitiesCount
        achievement {
          ...UserAchievementFields
        }
      }
    }
  }
`)
