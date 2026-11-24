defmodule GroupherServer.Messaging.Notices.Persist do
  @moduledoc """
  Owns grouped notification row persistence primitives.

  It creates, merges, finds and revokes rows without opening a transaction.
  Commands own transaction scope and mailbox projection synchronization.

      notification facts -> find/create/merge/revoke row
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Accounts}

  alias GroupherServer.{Messaging, Repo}
  alias Accounts.Model.User
  alias CMS.Model.Embeds
  alias Messaging.Model.Notice
  alias Helper.{Datetime, ORM}

  @notify_actions Messaging.Config.notify_actions() -- [:article_published]
  @notify_group_interval_hour Messaging.Config.notify_group_interval_hour()

  @doc """
  Creates or merges one grouped notification row.

  ## Examples

      Messaging.Notices.Persist.upsert(attrs, user)
  """
  @spec upsert(map(), User.t()) :: {:ok, Notice.t()} | {:error, term()}
  def upsert(attrs, %User{} = from_user) do
    from_user = Embeds.User.from_account_user(from_user)

    case find_existing(attrs, :latest_peroid) do
      {:ok, notify} -> merge_notification(notify, from_user)
      {:error, _} -> create_or_merge_notification(attrs, from_user)
    end
  end

  @doc """
  Finds grouped notifications that contain the actor contribution.

  ## Examples

      Messaging.Notices.Persist.find_for_revoke(attrs, user)
  """
  @spec find_for_revoke(map(), User.t()) :: {:ok, list()} | {:error, term()}
  def find_for_revoke(attrs, %User{} = from_user) do
    attrs
    |> Map.put(:from_user, from_user)
    |> find_existing(:all)
  end

  @doc """
  Removes one actor from each grouped notification or deletes an empty row.

  ## Examples

      Messaging.Notices.Persist.revoke_rows(notifications, user)
  """
  @spec revoke_rows([Notice.t()], User.t()) :: {:ok, :pass} | {:error, term()}
  def revoke_rows(notifications, %User{} = from_user) do
    Enum.each(notifications, &revoke_notice(&1, from_user))
    {:ok, :pass}
  end

  defp revoke_notice(notify, from_user) do
    case length(notify.from_users) == 1 do
      true ->
        ORM.delete(notify)

      false ->
        from_users =
          notify.from_users
          |> normalize_embed_users()
          |> Enum.reject(&(&1.login == from_user.login))

        ORM.update_embed(notify, :from_users, from_users)
    end
  end

  defp merge_notification(notify, from_user) do
    from_users =
      [from_user | normalize_embed_users(notify.from_users)]
      |> Enum.uniq_by(&Embeds.User.uniq_key/1)

    ORM.update_embed(notify, :from_users, from_users, %{from_users_count: length(from_users)})
  end

  defp create_notification(attrs, from_user) do
    attrs = attrs |> Map.merge(%{from_users_count: 1}) |> normalize_type_attr()

    %Notice{}
    |> Ecto.Changeset.change(attrs)
    |> Ecto.Changeset.put_embed(:from_users, normalize_embed_users([from_user]))
    |> Ecto.Changeset.unique_constraint(:user_id, name: :notices_unread_group_uniq_idx)
    |> Repo.insert(mode: :savepoint)
  end

  defp create_or_merge_notification(attrs, from_user) do
    case create_notification(attrs, from_user) do
      {:ok, notify} ->
        {:ok, notify}

      {:error, %Ecto.Changeset{} = changeset} ->
        if unique_group_constraint_violated?(changeset) do
          with {:ok, notify} <- find_existing(attrs, :latest_peroid) do
            merge_notification(notify, from_user)
          end
        else
          {:error, changeset}
        end
    end
  end

  defp unique_group_constraint_violated?(%Ecto.Changeset{errors: errors}) do
    Enum.any?(errors, fn
      {:user_id, {_message, opts}} -> opts[:constraint] == :unique
      _ -> false
    end)
  end

  defp find_existing(%{type: :follow} = attrs, opt) do
    do_find_existing(Notice, attrs, opt)
  end

  defp find_existing(%{comment_id: comment_id} = attrs, opt) when not is_nil(comment_id) do
    %{thread: thread, article_id: article_id, comment_id: comment_id} = attrs

    Notice
    |> where(
      [n],
      n.thread == ^thread and n.article_id == ^article_id and n.comment_id == ^comment_id
    )
    |> do_find_existing(attrs, opt)
  end

  defp find_existing(attrs, opt) do
    %{thread: thread, article_id: article_id} = attrs

    Notice
    |> where([n], n.thread == ^thread and n.article_id == ^article_id)
    |> do_find_existing(attrs, opt)
  end

  defp do_find_existing(queryable, attrs, :latest_peroid) do
    %{user_id: user_id, type: type} = normalize_type_attr(attrs)

    queryable
    |> where([n], n.inserted_at >= ^interval_threshold_time() and n.user_id == ^user_id)
    |> where([n], n.type == ^type and n.read == false)
    |> order_by([n], desc: n.inserted_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
    |> done_result()
  end

  defp do_find_existing(queryable, attrs, _opt) do
    %{user_id: user_id, type: type, from_user: from_user} = normalize_type_attr(attrs)

    queryable = where(queryable, [n], n.user_id == ^user_id and n.type == ^type)

    from(n in queryable,
      cross_join: fu in fragment("jsonb_array_elements(?)", n.from_users),
      where: fragment("?->>'login' = ?", fu, ^from_user.login)
    )
    |> Repo.all()
    |> done_result()
  end

  defp done_result(nil), do: {:error, nil}
  defp done_result(result), do: {:ok, result}

  defp interval_threshold_time do
    Datetime.now() |> Datetime.shift(hours: -@notify_group_interval_hour)
  end

  defp normalize_type_attr(attrs), do: attrs

  defp normalize_embed_users(users) do
    users |> Enum.map(&Embeds.User.normalize/1) |> Enum.filter(&Embeds.User.valid?/1)
  end

  @doc """
  Checks whether notification attributes use a supported action and provide its required fields.

  Required fields must be present and non-nil; this check does not query their database records.

  ## Examples

      iex> GroupherServer.Messaging.Notices.Persist.valid?(%{type: :follow, user_id: 1})
      true
      iex> GroupherServer.Messaging.Notices.Persist.valid?(%{type: :follow, user_id: nil})
      false
  """
  def valid?(%{type: type} = attrs) do
    type in @notify_actions and valid_attrs?(attrs)
  end

  defp valid_attrs?(%{type: :follow} = attrs), do: all_exist?(attrs, [:user_id])

  defp valid_attrs?(%{type: :upvote} = attrs) do
    all_exist?(attrs, [:article_id, :thread, :title, :user_id])
  end

  defp valid_attrs?(%{type: :collect} = attrs) do
    all_exist?(attrs, [:article_id, :thread, :title, :user_id])
  end

  defp valid_attrs?(%{type: :comment} = attrs) do
    all_exist?(attrs, [:article_id, :thread, :title, :comment_id, :user_id])
  end

  defp valid_attrs?(%{type: :reply} = attrs) do
    all_exist?(attrs, [:article_id, :thread, :title, :comment_id, :user_id])
  end

  defp valid_attrs?(%{type: type} = attrs)
       when type in [:ticket_status, :ticket_update, :ticket_visibility] do
    all_exist?(attrs, [:article_id, :thread, :title, :user_id])
  end

  defp valid_attrs?(_attrs), do: false

  defp all_exist?(attrs, keys) when is_map(attrs) and is_list(keys) do
    Enum.all?(keys, &(Map.has_key?(attrs, &1) and not is_nil(attrs[&1])))
  end
end
