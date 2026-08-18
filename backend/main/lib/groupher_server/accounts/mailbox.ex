defmodule GroupherServer.Accounts.Mailbox do
  @moduledoc """
  Account-facing mailbox facade and unread counter synchronizer.

  Read operations delegate to `GroupherServer.Messaging`; status updates fold
  unread counts from mentions and notifications back into the user's embedded
  mailbox state.

      Messaging row changes
          |
          v
      Mailbox.update_status_many/1
          |
          +--> lock affected users
          +--> group unread counts by user
          +--> batch update User.mailbox
          +--> invalidate user caches after commit
  """

  import Ecto.Query, warn: false
  import Helper.ErrorHandler, only: [not_found_formatter: 2]
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{ErrorCat, Messaging, Repo}
  alias GroupherServer.Accounts.Model.{Embeds, User}
  alias GroupherServer.FrontDesk.Cache, as: FrontDeskCache
  alias Helper.Constant.DBPrefix

  @default_status Embeds.UserMailbox.default_status()
  @account_prefix DBPrefix.account()

  @batch_update_mailboxes_sql """
  UPDATE #{@account_prefix}.users AS users
  SET mailbox = updates.mailbox,
      updated_at = date_trunc('second', now())
  FROM jsonb_to_recordset($1::jsonb) AS updates(id bigint, mailbox jsonb)
  WHERE users.id = updates.id
  RETURNING users.id, users.updated_at
  """

  @doc "Runs `status` through the public `Mailbox` boundary."
  def status(%User{mailbox: nil}), do: done(@default_status)
  def status(%User{mailbox: mailbox}), do: done(mailbox)

  @doc "Runs `mark_read` through the public `Mailbox` boundary."
  def mark_read(type, ids, %User{} = user), do: Messaging.mark_read(type, ids, user)
  @doc "Runs `mark_read_all` through the public `Mailbox` boundary."
  def mark_read_all(type, %User{} = user), do: Messaging.mark_read_all(type, user)
  @doc "Returns paged messages from the `Mailbox` read boundary."
  def paged_messages(type, user, filter), do: Messaging.paged_messages(type, user, filter)

  @doc """
  Synchronizes one user's persisted mailbox counters with the unread message rows.

  The update owns its database transaction and invalidates the FrontDesk cache
  only after that transaction commits. It returns the updated user.
  """
  def update_status(user_id) do
    with {:ok, [user]} <- update_users([user_id]) do
      invalidate_users([user])
      done(user)
    end
  end

  @doc """
  Synchronizes mailbox counters for all distinct, non-nil user IDs.

  Reads and writes are batched so the number of business SQL statements does not
  grow with the number of users. Cache invalidation is deliberately kept outside
  the database transaction.

      user_ids
          |
          v
      normalize + deduplicate
          |
          v
      database transaction
          |
          +--> lock users in ID order
          +--> group unread mention counts
          +--> group unread notification counts
          +--> batch update mailbox embeds
          |
          v
      commit
          |
          v
      invalidate FrontDesk user caches

  Returns `{:ok, :pass}` when all affected users are synchronized. If any user
  does not exist, no mailbox update is committed.
  """
  def update_status_many(user_ids) when is_list(user_ids) do
    case normalize_user_ids(user_ids) do
      [] ->
        done(:pass)

      user_ids ->
        with {:ok, users} <- update_users(user_ids) do
          invalidate_users(users)
          done(:pass)
        end
    end
  end

  @doc """
  Synchronizes mailbox counters inside an existing database transaction.

  This is the transaction-aware entry point used by messaging write flows. It
  performs database work only and returns the updated users so the caller can
  invalidate their caches after the outer transaction commits.

      existing transaction
          |
          v
      update_status_many_in_transaction/1
          |
          +--> lock + count + batch update
          |
          v
      return updated users
          |
          v
      caller commits, then invalidates caches
  """
  def update_status_many_in_transaction(user_ids) when is_list(user_ids) do
    case normalize_user_ids(user_ids) do
      [] -> {:ok, []}
      user_ids -> do_update_status_many(user_ids)
    end
  end

  @doc """
  Invalidates cached FrontDesk users after their mailbox transaction commits.

  Cache deletion is best-effort because the database commit has already
  succeeded. Missing logins and duplicate users are ignored.
  """
  def invalidate_users(users) when is_list(users) do
    users
    |> Enum.map(& &1.login)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.each(&FrontDeskCache.delete_user/1)

    :ok
  end

  defp update_users(user_ids) do
    case Repo.transaction(fn ->
           case update_status_many_in_transaction(user_ids) do
             {:ok, users} -> users
             {:error, reason} -> Repo.rollback(reason)
           end
         end) do
      {:ok, users} -> {:ok, users}
      {:error, reason} -> {:error, reason}
    end
  end

  defp do_update_status_many(user_ids) do
    with {:ok, users} <- lock_users(user_ids),
         {:ok, unread_mentions} <- Messaging.unread_counts(:mention, user_ids),
         {:ok, unread_notifications} <- Messaging.unread_counts(:notification, user_ids) do
      batch_update_mailboxes(users, unread_mentions, unread_notifications)
    end
  end

  defp lock_users(user_ids) do
    users =
      User
      |> where([u], u.id in ^user_ids)
      |> order_by([u], asc: u.id)
      |> lock("FOR UPDATE")
      |> Repo.all()

    found_user_ids = users |> MapSet.new(& &1.id)

    case Enum.find(user_ids, &(not MapSet.member?(found_user_ids, &1))) do
      nil ->
        {:ok, users}

      missing_user_id ->
        {:error,
         GroupherServer.Accounts.Profiles.ErrorCat.not_exist(
           not_found_formatter(User, missing_user_id)
         )}
    end
  end

  defp batch_update_mailboxes(users, unread_mentions, unread_notifications) do
    prepared_updates =
      Enum.map(users, fn user ->
        mailbox =
          build_mailbox(
            user.mailbox,
            Map.get(unread_mentions, user.id, 0),
            Map.get(unread_notifications, user.id, 0)
          )

        updated_user = %{user | mailbox: mailbox}
        payload = %{id: user.id, mailbox: Map.from_struct(mailbox)}

        {updated_user, payload}
      end)

    payload = Enum.map(prepared_updates, &elem(&1, 1))

    case Repo.query(@batch_update_mailboxes_sql, [payload]) do
      {:ok, %{num_rows: count, rows: rows}} when count == length(users) ->
        updated_at_by_id = Map.new(rows, fn [id, updated_at] -> {id, updated_at} end)

        users =
          Enum.map(prepared_updates, fn {user, _payload} ->
            %{user | updated_at: Map.fetch!(updated_at_by_id, user.id)}
          end)

        {:ok, users}

      {:ok, %{num_rows: count}} ->
        {:error,
         ErrorCat.custom(
           "mailbox batch update affected #{count} of #{length(users)} expected users"
         )}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp build_mailbox(mailbox, unread_mentions_count, unread_notifications_count) do
    unread_total_count = unread_mentions_count + unread_notifications_count

    mailbox = mailbox || %Embeds.UserMailbox{}

    %{
      mailbox
      | id: mailbox.id || Ecto.UUID.generate(),
        unread_mentions_count: unread_mentions_count,
        unread_notifications_count: unread_notifications_count,
        unread_total_count: unread_total_count,
        is_empty: unread_total_count < 1
    }
  end

  defp normalize_user_ids(user_ids) do
    user_ids
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end
end
