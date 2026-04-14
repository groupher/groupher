defmodule GroupherServer.Messaging.Notifications do
  @moduledoc false

  import Ecto.Query, warn: false

  import Helper.Utils,
    only: [get_config: 2, done: 1]

  import ShortMaps

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.User
  alias GroupherServer.CMS.Helper.Threads
  alias GroupherServer.CMS.Model.Embeds
  alias GroupherServer.Messaging.Model.Notification
  alias Helper.{Multi, ORM}

  @notify_actions get_config(:general, :nofity_actions)
  @notify_group_interval_hour get_config(:general, :notify_group_interval_hour)
  @cut_from_users_count 3

  def send(%{action: action, user_id: user_id} = attrs, %User{} = from_user) do
    with true <- action in @notify_actions,
         true <- valid?(attrs),
         true <- user_id !== from_user.id do
      Multi.new()
      |> Multi.run(:upsert_notifications, fn _, _ ->
        from_user = Embeds.User.from_account_user(from_user)

        case find_exist_notify(attrs, :latest_peroid) do
          {:ok, notify} -> merge_notification(notify, from_user)
          {:error, _} -> create_or_merge_notification(attrs, from_user)
        end
      end)
      |> Multi.run(:update_user_mailbox_status, fn _, %{upsert_notifications: nofity} ->
        Accounts.Mailbox.update_status(nofity.user_id)
      end)
      |> Repo.transaction()
      |> result()
    else
      false -> {:error, "invalid args for notification"}
      error -> error
    end
  end

  def revoke(attrs, %User{} = from_user) do
    attrs = attrs |> Map.put(:from_user, from_user)

    case find_exist_notify(attrs, :all) do
      {:ok, notifications} ->
        Multi.new()
        |> Multi.run(:revoke_notifications, fn _, _ ->
          Enum.each(notifications, fn notify ->
            case length(notify.from_users) == 1 do
              true ->
                ORM.delete(notify)

              false ->
                from_users =
                  notify.from_users
                  |> normalize_embed_users()
                  |> Enum.reject(&(&1.login == from_user.login))

                notify |> ORM.update_embed(:from_users, from_users)
            end
          end)
          |> done
        end)
        |> Multi.run(:update_user_mailbox_status, fn _, _ ->
          Enum.each(notifications, &Accounts.Mailbox.update_status(&1.user_id)) |> done
        end)
        |> Repo.transaction()
        |> result()

      {:error, _reason} ->
        {:ok, :pass}
    end
  end

  def paged(%User{} = user, %{page: page, size: size} = filter) do
    read = Map.get(filter, :read, false)

    Notification
    |> where([n], n.user_id == ^user.id and n.read == ^read)
    |> order_by([n], desc: n.inserted_at, desc: n.id)
    |> ORM.paginator(~m(page size)a)
    |> cut_from_users_ifneed
    |> done
  end

  def unread_count(user_id) do
    Notification
    |> where([n], n.user_id == ^user_id and n.read == false)
    |> ORM.count()
  end

  def mark_read(ids, %User{} = user) when is_list(ids) do
    Notification
    |> where([m], m.id in ^ids and m.user_id == ^user.id and m.read == false)
    |> ORM.mark_read_all()
  end

  def mark_read_all(%User{} = user) do
    Notification
    |> where([m], m.user_id == ^user.id and m.read == false)
    |> ORM.mark_read_all()
  end

  defp cut_from_users_ifneed(%{entries: entries} = paged_contents) do
    entries =
      Enum.map(entries, fn notify ->
        from_users = Enum.slice(notify.from_users, 0, @cut_from_users_count)
        notify |> Map.put(:from_users, from_users)
      end)

    paged_contents |> Map.put(:entries, entries)
  end

  defp merge_notification(notify, from_user) do
    from_users =
      ([from_user] ++ normalize_embed_users(notify.from_users))
      |> Enum.uniq_by(&Embeds.User.uniq_key/1)

    notify
    |> ORM.update_embed(:from_users, from_users, %{from_users_count: length(from_users)})
  end

  defp create_notification(attrs, from_user) do
    attrs =
      attrs
      |> Map.merge(%{from_users_count: 1})
      |> normalize_thread_attr()
      |> normalize_action_attr()

    %Notification{}
    |> Ecto.Changeset.change(attrs)
    |> Ecto.Changeset.put_embed(:from_users, normalize_embed_users([from_user]))
    |> Ecto.Changeset.unique_constraint(:user_id, name: :notifications_unread_group_uniq_idx)
    # Keep unique-conflict failures isolated, so the outer transaction can continue
    # and fallback to find+merge without hitting 25P02 (aborted transaction).
    |> Repo.insert(mode: :savepoint)
  end

  defp create_or_merge_notification(attrs, from_user) do
    case create_notification(attrs, from_user) do
      {:ok, notify} ->
        {:ok, notify}

      {:error, %Ecto.Changeset{} = changeset} ->
        if unique_group_constraint_violated?(changeset) do
          with {:ok, notify} <- find_exist_notify(attrs, :latest_peroid) do
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

  defp find_exist_notify(%{action: :follow} = attrs, opt) do
    do_find_exist_notify(Notification, attrs, opt)
  end

  defp find_exist_notify(%{comment_id: comment_id} = attrs, opt)
       when not is_nil(comment_id) do
    %{thread: thread, article_id: article_id, comment_id: comment_id} = normalize_thread_attr(attrs)

    Notification
    |> where(
      [n],
      n.thread == ^thread and n.article_id == ^article_id and n.comment_id == ^comment_id
    )
    |> do_find_exist_notify(attrs, opt)
  end

  defp find_exist_notify(attrs, opt) do
    %{thread: thread, article_id: article_id} = normalize_thread_attr(attrs)

    Notification
    |> where([n], n.thread == ^thread and n.article_id == ^article_id)
    |> do_find_exist_notify(attrs, opt)
  end

  @spec do_find_exist_notify(Ecto.Queryable.t(), map(), atom()) ::
          {atom(), Notification.t()}
  defp do_find_exist_notify(queryable, attrs, :latest_peroid) do
    %{user_id: user_id, action: action} = normalize_action_attr(attrs)

    queryable
    |> where([n], n.inserted_at >= ^interval_threshold_time() and n.user_id == ^user_id)
    |> where([n], n.action == ^action and n.read == false)
    |> order_by([n], desc: n.inserted_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
    |> done
  end

  @spec do_find_exist_notify(Ecto.Queryable.t(), map(), atom()) ::
          {atom(), [Notification.t()]}
  defp do_find_exist_notify(queryable, attrs, _opt) do
    %{user_id: user_id, action: action, from_user: from_user} = normalize_action_attr(attrs)

    queryable = queryable |> where([n], n.user_id == ^user_id and n.action == ^action)

    from(n in queryable,
      cross_join: fu in fragment("jsonb_array_elements(?)", n.from_users),
      where: fragment("?->>'login' = ?", fu, ^from_user.login)
    )
    |> Repo.all()
    |> done
  end

  defp valid?(%{action: :follow} = attrs), do: attrs |> all_exist?([:user_id])

  defp valid?(%{action: :upvote} = attrs) do
    attrs |> all_exist?([:article_id, :thread, :title, :user_id])
  end

  defp valid?(%{action: :collect} = attrs) do
    attrs |> all_exist?([:article_id, :thread, :title, :user_id])
  end

  defp valid?(%{action: :comment} = attrs) do
    attrs |> all_exist?([:article_id, :thread, :title, :comment_id, :user_id])
  end

  defp valid?(%{action: :reply} = attrs) do
    attrs |> all_exist?([:article_id, :thread, :title, :comment_id, :user_id])
  end

  defp valid?(_), do: false

  defp all_exist?(attrs, keys) when is_map(attrs) and is_list(keys) do
    Enum.all?(keys, &(Map.has_key?(attrs, &1) and not is_nil(attrs[&1])))
  end

  defp interval_threshold_time do
    Timex.shift(Timex.now(), hours: -@notify_group_interval_hour)
  end

  defp normalize_thread_attr(%{thread: thread} = attrs) do
    case Threads.to_atom(thread) do
      {:ok, normalized} -> Map.put(attrs, :thread, normalized)
      {:error, _} -> attrs
    end
  end

  defp normalize_thread_attr(attrs), do: attrs

  defp normalize_action_attr(%{action: action} = attrs) when is_atom(action) do
    Map.put(attrs, :action, action |> to_string() |> String.upcase())
  end

  defp normalize_action_attr(attrs), do: attrs

  defp normalize_embed_users(users) do
    users
    |> Enum.map(&Embeds.User.normalize/1)
    |> Enum.filter(&Embeds.User.valid?/1)
  end

  defp result({:ok, %{upsert_notifications: result}}), do: {:ok, result}
  defp result({:ok, %{revoke_notifications: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
