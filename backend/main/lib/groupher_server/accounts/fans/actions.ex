defmodule GroupherServer.Accounts.Fans.Actions do
  @moduledoc false

  import Helper.ErrorCode

  alias GroupherServer.{Accounts, Repo}
  alias Accounts.{Events, FrontDesk}
  alias Accounts.Model.{User, UserFollower, UserFollowing}
  alias Helper.{Multi, Later, ORM, T}

  @spec follow(User.t(), User.t()) :: {:ok, User.t()} | T.gq_error()
  def follow(%User{} = user, %User{} = follower) do
    with true <- to_string(user.id) !== to_string(follower.id),
         {:ok, user} <- FrontDesk.user(user.id),
         {:ok, target_user} <- FrontDesk.user(follower.id) do
      Multi.new()
      |> Multi.insert(
        :create_follower,
        UserFollower.changeset(%UserFollower{}, %{user_id: target_user.id, follower_id: user.id})
      )
      |> Multi.insert(
        :create_following,
        UserFollowing.changeset(%UserFollowing{}, %{
          user_id: user.id,
          following_id: target_user.id
        })
      )
      |> Multi.run(:update_user_follow_info, fn _, _ ->
        update_user_follow_info(target_user, user, :add)
      end)
      |> Multi.run(:add_achievement, fn _, _ ->
        GroupherServer.Accounts.Achievements.achieve(%User{id: target_user.id}, :inc, :follow)
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        Later.run({Events, :emit, [:follow, %{user: user, from_user: follower}]})
      end)
      |> Repo.transaction()
      |> result()
    else
      false -> {:error, [message: "can't follow yourself", code: ecode(:self_conflict)]}
      {:error, reason} -> {:error, [message: reason, code: ecode(:not_exist)]}
    end
  end

  @spec undo_follow(User.t(), User.t()) :: {:ok, User.t()} | T.gq_error()
  def undo_follow(%User{} = user, %User{} = follower) do
    with true <- to_string(user.id) !== to_string(follower.id),
         {:ok, user} <- FrontDesk.user(user.id),
         {:ok, target_user} <- FrontDesk.user(follower.id) do
      Multi.new()
      |> Multi.run(:delete_follower, fn _, _ ->
        ORM.findby_delete!(UserFollower, %{user_id: target_user.id, follower_id: user.id})
      end)
      |> Multi.run(:delete_following, fn _, _ ->
        ORM.findby_delete!(UserFollowing, %{user_id: user.id, following_id: target_user.id})
      end)
      |> Multi.run(:update_user_follow_info, fn _, _ ->
        update_user_follow_info(target_user, user, :remove)
      end)
      |> Multi.run(:minus_achievement, fn _, _ ->
        GroupherServer.Accounts.Achievements.achieve(%User{id: target_user.id}, :dec, :follow)
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        Later.run({Events, :emit, [:undo_follow, %{user: user, from_user: follower}]})
      end)
      |> Repo.transaction()
      |> result()
    else
      false -> {:error, [message: "can't undo follow yourself", code: ecode(:self_conflict)]}
      {:error, reason} -> {:error, [message: reason, code: ecode(:not_exist)]}
    end
  end

  defp update_user_follow_info(%User{} = target_user, %User{} = user, opt) do
    with {:ok, user} <- ORM.fill_meta(user) do
      follower_user_ids =
        case opt do
          :add -> (target_user.meta.follower_user_ids ++ [user.id]) |> Enum.uniq()
          :remove -> (target_user.meta.follower_user_ids -- [user.id]) |> Enum.uniq()
        end

      following_user_ids =
        case opt do
          :add -> (user.meta.following_user_ids ++ [target_user.id]) |> Enum.uniq()
          :remove -> (user.meta.following_user_ids -- [target_user.id]) |> Enum.uniq()
        end

      Multi.new()
      |> Multi.run(:update_follower_meta, fn _, _ ->
        {:ok, target_user} =
          ORM.update(target_user, %{followers_count: length(follower_user_ids)})

        ORM.update_meta(target_user, %{follower_user_ids: follower_user_ids})
      end)
      |> Multi.run(:update_following_meta, fn _, _ ->
        {:ok, user} = ORM.update(user, %{followings_count: length(following_user_ids)})
        ORM.update_meta(user, %{following_user_ids: following_user_ids})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec result({:ok, map()}) :: T.done()
  defp result({:ok, %{create_follower: user_follower}}) do
    User |> ORM.find(user_follower.user_id)
  end

  defp result({:ok, %{delete_follower: user_follower}}) do
    User |> ORM.find(user_follower.user_id)
  end

  defp result({:ok, %{update_follower_meta: result}}) do
    {:ok, result}
  end

  defp result({:error, :create_follower, %Ecto.Changeset{}, _steps}) do
    {:error, [message: "already followed", code: ecode(:already_did)]}
  end

  defp result({:error, :create_follower, _result, _steps}) do
    {:error, [message: "already followed", code: ecode(:already_did)]}
  end

  defp result({:error, :create_following, _result, _steps}) do
    {:error, [message: "follow fails", code: ecode(:react_fails)]}
  end

  defp result({:error, :delete_follower, _result, _steps}) do
    {:error, [message: "already unfollowed", code: ecode(:already_did)]}
  end

  defp result({:error, :delete_following, _result, _steps}) do
    {:error, [message: "unfollow fails", code: ecode(:react_fails)]}
  end

  defp result({:error, :minus_achievement, _result, _steps}) do
    {:error, [message: "follow acieve fails", code: ecode(:react_fails)]}
  end

  defp result({:error, :add_achievement, _result, _steps}) do
    {:error, [message: "follow acieve fails", code: ecode(:react_fails)]}
  end
end
