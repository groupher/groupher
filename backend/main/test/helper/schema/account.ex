defmodule GroupherServer.Test.Helper.Schema.Account do
  @moduledoc "GraphQL documents used by account tests."

  def m(:update_profile) do
    """
    mutation(
          $profile: UserProfileInput!,
          $social: SocialInput,
        ) {
          updateProfile(
            profile: $profile,
            social: $social,
          ) {
            avatar
            nickname
            social {
              zhihu
              github
              blog
              twitter
              company
            }
          }
        }
    """
  end

  def q(:me) do
    """
    query {
          me {
            login
            nickname
            avatar
            bio
          }
        }
    """
  end

  def q(:user) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            nickname
            bio
            meta {
              publishedPostsCount
              publishedBlogsCount
            }
            views
            passport
            passportString
            subscribedCommunitiesCount
            followersCount
            followingsCount
            contributes {
              records {
                count
                date
              }
              startDate
              endDate
              totalCount
            }
            social {
              github
              douban
            }
          }
        }
    """
  end

  def q(:paged_users) do
    """
    query($filter: PagedUsersFilter!) {
          pagedUsers(filter: $filter) {
            entries {
              login
              nickname
              bio
              viewerHasFollowed
              viewerBeenFollowed
            }
            totalPages
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:subscribed_communities) do
    """
    query($filter: PagiFilter!) {
          subscribedCommunities(filter: $filter) {
            entries {
              title
              slug
            }
            totalCount
            totalPages
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:subscribed_communities_2) do
    """
    query($login: String, $filter: PagiFilter!) {
          subscribedCommunities(login: $login, filter: $filter) {
            entries {
              title
            }
            totalCount
            totalPages
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:session_state) do
    """
    query {
          sessionState {
            isValid
            delegationSubject
            user {
              login
            }
          }
        }
    """
  end

  def q(:search_users) do
    """
    query($name: String!) {
          searchUsers(name: $name) {
            entries {
              login
              nickname
            }
            totalCount
          }
        }
    """
  end

  def q(:user_2) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            achievement {
              reputation
              articlesUpvotesCount
              articlesCollectsCount
              sourceContribute {
                web
                server
              }
            }
          }
        }
    """
  end

  def q(:moderatorable_communities) do
    """
    query($login: String, $filter: PagiFilter!) {
          moderatorableCommunities(login: $login, filter: $filter) {
            entries {
              logo
              title
              slug
            }
            totalPages
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:user_3) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            followersCount
            followingsCount
            achievement {
              reputation
            }
          }
        }
    """
  end

  def q(:user_4) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            achievement {
              reputation
              articlesCollectsCount
            }
          }
        }
    """
  end
end
