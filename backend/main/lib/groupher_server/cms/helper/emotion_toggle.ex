defmodule GroupherServer.CMS.Helper.EmotionToggle do
  @moduledoc """
  Shared write-path helpers for article/comment emotion toggles.

  Design intent:
  - the narrow emotion tables are the source of truth
  - comment/article embeds remain the read-optimized cache
  - `persist/4` only changes the fact table
  - `update_embed/5` incrementally syncs the cached aggregate after a successful change

  Example:

      iex> EmotionToggle.persist(CommentUserEmotion, %{comment_id: 1, user_id: 2, recived_user_id: 3}, :beer, true)
      {:ok, true}

      iex> EmotionToggle.persist(CommentUserEmotion, %{comment_id: 1, user_id: 2, recived_user_id: 3}, :beer, true)
      {:ok, false}

  The second call is idempotent because the same `(target, user, emotion)` row
  already exists.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Embeds
  alias Helper.ORM

  @max_latest_emotion_users_count 4

  @spec persist(module(), map(), atom(), boolean()) :: {:ok, boolean()} | {:error, term()}
  def persist(schema, target, emotion, desired_state) when is_boolean(desired_state) do
    target = Map.put(target, :emotion, to_string(emotion))

    case ORM.find_by(schema, target) do
      {:ok, emotion_record} ->
        case desired_state do
          true -> {:ok, false}
          false -> emotion_record |> ORM.delete() |> to_change_result()
        end

      {:error, _} ->
        case desired_state do
          true -> target |> then(&ORM.create(schema, &1)) |> to_change_result()
          false -> {:ok, false}
        end
    end
  end

  @spec update_embed(map(), atom(), User.t(), :add | :remove, (() -> [map()])) ::
          {:ok, map()} | {:error, map()}
  def update_embed(artiment, emotion, %User{} = user, opt, latest_users_loader \\ fn -> [] end)
      when opt in [:add, :remove] and is_function(latest_users_loader, 0) do
    emotions = artiment.emotions || %{}
    count_key = :"#{emotion}_count"
    logins_key = :"#{emotion}_user_logins"
    latest_users_key = :"latest_#{emotion}_users"
    viewer_key = :"viewer_has_#{emotion}ed"

    cur_count = Map.get(emotions, count_key, 0)
    cur_logins = Map.get(emotions, logins_key, [])
    cur_users = Map.get(emotions, latest_users_key, []) |> normalize_embed_users()

    has_login = Enum.member?(cur_logins, user.login)
    has_latest_user = Enum.any?(cur_users, &user_id_match?(&1, user.id))

    updated_count =
      case opt do
        :add -> if(has_login, do: cur_count, else: cur_count + 1)
        :remove -> if(has_login, do: max(cur_count - 1, 0), else: cur_count)
      end

    updated_logins =
      case opt do
        :add -> [user.login | cur_logins] |> Enum.uniq()
        :remove -> cur_logins -- [user.login]
      end

    updated_users =
      case opt do
        :add ->
          [extract_embed_user(user) | cur_users]
          |> normalize_embed_users()
          |> Enum.slice(0, @max_latest_emotion_users_count)

        :remove ->
          cur_users
          |> Enum.reject(&user_id_match?(&1, user.id))
          |> maybe_backfill_latest_users(updated_logins, has_latest_user, latest_users_loader)
      end

    updated_fields =
      %{}
      |> Map.put(count_key, updated_count)
      |> Map.put(logins_key, updated_logins)
      |> Map.put(latest_users_key, updated_users)
      |> Map.put(viewer_key, user.login in updated_logins)

    artiment |> ORM.update_embed(:emotions, updated_fields)
  end

  defp to_change_result({:ok, _record}), do: {:ok, true}
  defp to_change_result({:error, reason}), do: {:error, reason}

  defp extract_embed_user(%User{} = user) do
    user
    |> Embeds.User.from_account_user()
    |> Map.from_struct()
  end

  defp normalize_embed_users(users) do
    users
    |> Enum.map(&Embeds.User.normalize/1)
    |> Enum.filter(&Embeds.User.valid?/1)
    |> Enum.uniq_by(&Embeds.User.uniq_key/1)
  end

  defp maybe_backfill_latest_users(users, updated_logins, true, latest_users_loader) do
    users
    |> maybe_reload_latest_users(updated_logins, latest_users_loader)
    |> normalize_embed_users()
    |> Enum.slice(0, @max_latest_emotion_users_count)
  end

  defp maybe_backfill_latest_users(users, _updated_logins, _has_latest_user, _latest_users_loader) do
    users |> normalize_embed_users() |> Enum.slice(0, @max_latest_emotion_users_count)
  end

  defp maybe_reload_latest_users(users, updated_logins, latest_users_loader) do
    if length(updated_logins) > length(users) do
      latest_users_loader.()
    else
      users
    end
  end

  defp user_id_match?(user, user_id) do
    Map.get(user, :user_id) == user_id || Map.get(user, "user_id") == user_id
  end
end
