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
    query($filter: UserListFilter, $pagi: PagiInput) {
          pagedUsers(filter: $filter, pagi: $pagi) {
            entries {
              login
              nickname
              bio
              viewerHasFollowed
              viewerBeenFollowed
            }
            pageInfo { hasNextPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { endCursor } }
          }
        }
    """
  end

  def q(:subscribed_communities) do
    """
    query { defaultCommunitySuggestions { title slug } }
    """
  end

  def q(:subscribed_communities_2) do
    """
    query { defaultCommunitySuggestions { title slug } }
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
              login
              nickname


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
    query($login: String, $pagi: PagiInput) {
          moderatorableCommunities(login: $login, pagi: $pagi) {
            entries {
              logo
              title
              slug
            }
            pageInfo { hasNextPage ... on OffsetPageInfo { page size totalPages totalCount } ... on CursorPageInfo { endCursor } }
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
