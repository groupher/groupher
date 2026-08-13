defmodule GroupherServer.Messaging.Mentions do
  @moduledoc """
  Stores direct mention messages shown in a user's inbox.

  Mention rows are viewer-facing mailbox items, separate from the CMS mention
  fact graph. Sending mentions replaces the previous rows for the same content
  and author, inserts the current recipients, then refreshes affected mailbox
  counters.

      CMS content save
          |
          v
      mention recipients
          |
          v
      Messaging.Mentions.send/3
          |
          +--> delete old rows for this content/author
          +--> insert current recipient rows
          +--> Accounts.Mailbox.update_status_many/1
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.FrontDesk, only: [thread_of: 1]
  import ShortMaps

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.Model.Comment
  alias GroupherServer.Messaging.Model.Mention
  alias Helper.{Multi, ORM}

  @doc "Runs `send` through the public `Mentions` boundary."
  def send(_, [], _), do: {:ok, :pass}

  def send(%Comment{} = comment, mentions, %User{} = from_user) do
    Multi.new()
    |> Multi.run(:batch_delete_mentions, fn _, _ ->
      batch_delete_mentions(comment, from_user)
    end)
    |> Multi.run(:batch_insert_mentions, fn _, _ ->
      with {:ok, mentions} <- normalize_mentions(mentions) do
        case Enum.empty?(mentions) or {0, nil} !== Repo.insert_all(Mention, mentions) do
          true -> {:ok, mentions}
          false -> {:error, "insert mentions error"}
        end
      end
    end)
    |> Multi.run(:update_user_mailbox_status, fn _, %{batch_insert_mentions: mentions} ->
      mentions
      |> Enum.map(& &1.to_user_id)
      |> Accounts.Mailbox.update_status_many_in_transaction()
    end)
    |> Repo.transaction()
    |> result()
  end

  def send(article, mentions, %User{} = from_user) do
    Multi.new()
    |> Multi.run(:batch_delete_mentions, fn _, _ ->
      batch_delete_mentions(article, from_user)
    end)
    |> Multi.run(:batch_insert_mentions, fn _, _ ->
      with {:ok, mentions} <- normalize_mentions(mentions) do
        mentions =
          mentions
          |> Enum.reject(&(&1.to_user_id == from_user.id))

        case Enum.empty?(mentions) or {0, nil} !== Repo.insert_all(Mention, mentions) do
          true -> {:ok, mentions}
          false -> {:error, "insert mentions error"}
        end
      end
    end)
    |> Multi.run(:update_user_mailbox_status, fn _, %{batch_insert_mentions: mentions} ->
      mentions
      |> Enum.map(& &1.to_user_id)
      |> Accounts.Mailbox.update_status_many_in_transaction()
    end)
    |> Repo.transaction()
    |> result()
  end

  defp normalize_mentions(mentions) do
    mentions
    |> Enum.reduce_while({:ok, []}, fn mention, {:ok, acc} ->
      case normalize_mention(mention) do
        {:ok, mention} -> {:cont, {:ok, [mention | acc]}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, mentions} -> {:ok, Enum.reverse(mentions)}
      error -> error
    end
  end

  defp normalize_mention(%{thread: thread} = mention) when is_atom(thread) do
    case Threads.to_atom(thread) do
      {:ok, thread} -> {:ok, %{mention | thread: thread}}
      {:error, _reason} -> {:error, "insert mentions error"}
    end
  end

  defp normalize_mention(%{thread: _thread}), do: {:error, "insert mentions error"}

  defp normalize_mention(mention), do: {:ok, mention}

  @doc "Runs `paged` through the public `Mentions` boundary."
  def paged(%User{} = user, %{page: page, size: size} = filter) do
    read = Map.get(filter, :read, false)

    Mention
    |> where([m], m.to_user_id == ^user.id and m.read == ^read)
    |> ORM.paginator(~m(page size)a)
    |> extract_mentions
    |> done()
  end

  @doc "Runs `unread_count` through the public `Mentions` boundary."
  def unread_count(user_id) do
    Mention
    |> where([m], m.to_user_id == ^user_id and m.read == false)
    |> ORM.count()
  end

  @doc """
  Counts unread mentions for multiple users in one grouped database query.

  Returns `{:ok, %{user_id => count}}`; user IDs with zero unread mentions are
  omitted from the map.
  """
  def unread_counts(user_ids) when is_list(user_ids) do
    Mention
    |> where([m], m.to_user_id in ^user_ids and m.read == false)
    |> group_by([m], m.to_user_id)
    |> select([m], {m.to_user_id, count(m.id)})
    |> Repo.all()
    |> Map.new()
    |> done()
  end

  @doc "Runs `mark_read` through the public `Mentions` boundary."
  def mark_read(ids, %User{} = user) when is_list(ids) do
    Mention
    |> where([m], m.id in ^ids and m.to_user_id == ^user.id and m.read == false)
    |> ORM.mark_read_all()
  end

  @doc "Runs `mark_read_all` through the public `Mentions` boundary."
  def mark_read_all(%User{} = user) do
    Mention
    |> where([m], m.to_user_id == ^user.id and m.read == false)
    |> ORM.mark_read_all()
  end

  defp batch_delete_mentions(%Comment{} = comment, %User{} = from_user) do
    from(m in Mention,
      where: m.comment_id == ^comment.id,
      where: m.from_user_id == ^from_user.id
    )
    |> ORM.delete_all(:if_exist)
  end

  defp batch_delete_mentions(article, %User{} = from_user) do
    with {:ok, thread} <- thread_of(article) do
      from(m in Mention,
        where: m.article_id == ^article.id,
        where: m.thread == ^thread,
        where: m.from_user_id == ^from_user.id
      )
      |> ORM.delete_all(:if_exist)
    end
  end

  defp extract_mentions(%{entries: entries} = paged_mentions) do
    entries = entries |> Repo.preload(:from_user) |> Enum.map(&shape(&1))

    Map.put(paged_mentions, :entries, entries)
  end

  defp shape(%Mention{} = mention) do
    user = Map.take(mention.from_user, [:login, :nickname, :avatar])

    mention
    |> Map.take([
      :id,
      :thread,
      :article_id,
      :comment_id,
      :title,
      :block_linker,
      :inserted_at,
      :updated_at,
      :read
    ])
    |> Map.put(:user, user)
  end

  defp result({:ok, %{batch_insert_mentions: _result, update_user_mailbox_status: updated_users}}) do
    Accounts.Mailbox.invalidate_users(updated_users)
    {:ok, :pass}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
