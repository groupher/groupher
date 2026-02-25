defmodule GroupherServer.Accounts.Fans.List do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.Accounts

  alias Accounts.Fans.ViewerState
  alias Accounts.Model.{User, UserFollower, UserFollowing}
  alias Helper.{ORM, QueryBuilder}

  def paged_followers(%User{id: user_id}, filter, %User{} = cur_user) do
    paged_followers(%User{id: user_id}, filter)
    |> ViewerState.mark_viewer_follow_status(cur_user)
    |> done()
  end

  def paged_followers(%User{id: user_id}, filter) do
    UserFollower
    |> where([uf], uf.user_id == ^user_id)
    |> join(:inner, [uf], u in assoc(uf, :follower))
    |> load_fans(filter)
  end

  def paged_followings(%User{id: user_id}, filter, %User{} = cur_user) do
    paged_followings(%User{id: user_id}, filter)
    |> ViewerState.mark_viewer_follow_status(cur_user)
    |> done()
  end

  def paged_followings(%User{id: user_id}, filter) do
    UserFollowing
    |> where([uf], uf.user_id == ^user_id)
    |> join(:inner, [uf], u in assoc(uf, :following))
    |> load_fans(filter)
  end

  defp load_fans(queryable, ~m(page size)a = filter) do
    queryable
    |> select([uf, u], u)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end
end
