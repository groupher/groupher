defmodule GroupherServer.Accounts.Fans do
  @moduledoc """
  Accounts fans facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.Types, as: T

  alias __MODULE__.{Actions, List, ViewerState}

  @spec follow(User.t(), User.t()) :: T.gq_result(User.t())
  def follow(%User{} = user, %User{} = follower), do: Actions.follow(user, follower)

  @spec undo_follow(User.t(), User.t()) :: T.gq_result(User.t())
  def undo_follow(%User{} = user, %User{} = follower), do: Actions.undo_follow(user, follower)

  @spec paged_followers(User.t(), map()) :: T.domain_res(T.paged_users())
  def paged_followers(%User{} = user, filter), do: List.paged_followers(user, filter)

  @spec paged_followers(User.t(), map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_followers(%User{} = user, filter, %User{} = cur_user) do
    List.paged_followers(user, filter, cur_user)
  end

  @spec paged_followings(User.t(), map()) :: T.domain_res(T.paged_users())
  def paged_followings(%User{} = user, filter), do: List.paged_followings(user, filter)

  @spec paged_followings(User.t(), map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_followings(%User{} = user, filter, %User{} = cur_user) do
    List.paged_followings(user, filter, cur_user)
  end

  @spec mark_viewer_follow_status(T.domain_res(T.paged_users()), User.t()) :: T.domain_res(T.paged_users())
  def mark_viewer_follow_status(result, %User{} = cur_user) do
    ViewerState.mark_viewer_follow_status(result, cur_user)
  end
end
