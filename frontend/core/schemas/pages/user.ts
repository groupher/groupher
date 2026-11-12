import { graphql } from '~/graphql/authoring'

export const me = graphql(`
  "Get cur user"
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
  "Get user by login"
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

export const trackProfileView = graphql(`
  "Records one visible public Profile read through ProfileViewTracker"
  mutation TrackProfileView($login: String!) {
    trackProfileView(login: $login) {
      tracked
      views
    }
  }
`)

export const sessionState = graphql(`
  "Check the cur token is valid or not"
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
