defmodule GroupherServer.Accounts.Fans do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Fans
  alias GroupherServer.Accounts.Model.User

  @spec follow(User.t(), User.t()) :: T.gq_result(User.t())
  def follow(user, follower), do: Fans.follow(user, follower)

  @spec undo_follow(User.t(), User.t()) :: T.gq_result(User.t())
  def undo_follow(user, follower), do: Fans.undo_follow(user, follower)

  @spec paged_followers(User.t(), map()) :: T.domain_res(T.paged_users())
  def paged_followers(user, filter), do: Fans.paged_followers(user, filter)

  @spec paged_followers(User.t(), map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_followers(user, filter, cur_user), do: Fans.paged_followers(user, filter, cur_user)

  @spec paged_followings(User.t(), map()) :: T.domain_res(T.paged_users())
  def paged_followings(user, filter), do: Fans.paged_followings(user, filter)

  @spec paged_followings(User.t(), map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_followings(user, filter, cur_user), do: Fans.paged_followings(user, filter, cur_user)
end
