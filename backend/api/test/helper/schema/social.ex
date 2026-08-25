defmodule GroupherServer.Test.Helper.Schema.Social do
  @moduledoc "GraphQL documents used by social tests."

  def m(:follow) do
    """
    mutation($login: String!) {
          follow(login: $login) {
            login
            viewerHasFollowed
          }
        }
    """
  end

  def m(:undo_follow) do
    """
    mutation($login: String!) {
          undoFollow(login: $login) {
            login
          }
        }
    """
  end

  def q(:paged_followings) do
    """
    query($login: String!, $filter: PagiFilter!) {
          pagedFollowings(login: $login, filter: $filter) {
            entries {
              login
              viewerHasFollowed
            }
            totalCount
          }
        }
    """
  end

  def q(:user) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            followersCount
          }
        }
    """
  end

  def q(:user_2) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            followingsCount
          }
        }
    """
  end

  def q(:user_3) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            viewerHasFollowed
          }
        }
    """
  end

  def q(:user_4) do
    """
    query($login: String!) {
          user(login: $login) {
            login
            viewerBeenFollowed
          }
        }
    """
  end

  def q(:paged_upvoted_articles) do
    """
    query($login: String!, $filter: UpvotedArticlesFilter!) {
          pagedUpvotedArticles(login: $login, filter: $filter) {
            entries {
              innerId
              title
              thread
            }
            totalCount
          }
        }
    """
  end

  def q(:paged_followers) do
    """
    query($login: String!, $filter: PagiFilter!) {
          pagedFollowers(login: $login, filter: $filter) {
            entries {
              login
              viewerBeenFollowed
              viewerHasFollowed
            }
            totalCount
          }
        }
    """
  end
end
