defmodule GroupherServer.Messaging.Notices.FirstPublication do
  @moduledoc """
  Delivers the author, content and recipient snapshot captured at first publication.

      committed Article Outbox event -> frozen author / captured recipients
        -> atomic Dedup + Notice + mailbox projection -> invalidate recipient caches

  Delivery never reloads the Article, its current author details or its admins.
  Each event and recipient owns one delivery key, independent of notice read or
  deletion state; first-publication notices do not use activity aggregation.
  """

  alias GroupherServer.{Accounts, CMS, Messaging, Repo}
  alias Accounts.Model.User
  alias CMS.Model.Embeds
  alias Messaging.Model.Notice
  alias Messaging.Notices.Dedup

  @threads CMS.artiment_threads_article_enums()

  @doc "Persists one captured publication notice per recipient without repeating a delivery."
  def deliver(event) do
    with {:ok, snapshot} <- snapshot(event) do
      case Repo.transaction(fn ->
             case persist_recipients(snapshot) do
               {:ok, result} -> result
               {:error, reason} -> Repo.rollback(reason)
             end
           end) do
        {:ok, {result, users}} ->
          _ = Accounts.mailbox_invalidate_users(users)
          {:ok, result}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp snapshot(%{
         event_id: event_id,
         article_id: article_id,
         title: title,
         thread: thread,
         author: author,
         recipient_ids: recipient_ids
       }) do
    with {:ok, event_id} <- Ecto.UUID.cast(event_id),
         {:ok, article_id} <- Ecto.UUID.cast(article_id),
         true <- is_binary(title),
         {:ok, thread} <- thread(thread),
         {:ok, author} <- author(author),
         {:ok, recipient_ids} <- recipients(recipient_ids) do
      {:ok,
       %{
         event_id: event_id,
         article_id: article_id,
         title: title,
         thread: thread,
         author: author,
         recipient_ids: recipient_ids
       }}
    else
      _ -> {:error, :invalid_first_publication_notice}
    end
  end

  defp snapshot(_event), do: {:error, :invalid_first_publication_notice}

  defp thread(value) do
    case Enum.find(@threads, &(value == &1 or value == Atom.to_string(&1))) do
      nil -> {:error, :invalid_first_publication_notice}
      thread -> {:ok, thread}
    end
  end

  defp author(attrs) when is_map(attrs) do
    changeset = Embeds.User.changeset(%Embeds.User{}, attrs)

    with {:ok, author} <- Ecto.Changeset.apply_action(changeset, :insert),
         true <- is_integer(author.id) and author.id > 0 and author.user_id == author.id do
      {:ok, author}
    else
      _ -> {:error, :invalid_first_publication_notice}
    end
  end

  defp author(_attrs), do: {:error, :invalid_first_publication_notice}

  defp recipients(ids) when is_list(ids) do
    if Enum.all?(ids, &(is_integer(&1) and &1 > 0)) do
      {:ok, Enum.sort(Enum.uniq(ids))}
    else
      {:error, :invalid_first_publication_notice}
    end
  end

  defp recipients(_ids), do: {:error, :invalid_first_publication_notice}

  defp persist_recipients(snapshot) do
    result =
      Enum.reduce_while(snapshot.recipient_ids, {:ok, []}, fn recipient_id, {:ok, notices} ->
        case persist_recipient(snapshot, recipient_id) do
          {:ok, :already_delivered} -> {:cont, {:ok, notices}}
          {:ok, notice} -> {:cont, {:ok, [notice | notices]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)

    with {:ok, notices} <- result,
         {:ok, users} <- refresh_mailboxes(notices) do
      outcome =
        if notices == [] and snapshot.recipient_ids != [] do
          :already_delivered
        else
          :delivered
        end

      {:ok,
       {%{
          outcome: outcome,
          notice_ids: notices |> Enum.map(& &1.id) |> Enum.sort(),
          recipient_ids: snapshot.recipient_ids
        }, users}}
    end
  end

  defp persist_recipient(snapshot, recipient_id) do
    key = "article-first-publication:#{snapshot.event_id}:#{recipient_id}"

    with %User{} <- Repo.get(User, recipient_id),
         {:ok, :claimed} <- Dedup.claim(key),
         {:ok, notice} <-
           %Notice{}
           |> Notice.changeset(%{
             user_id: recipient_id,
             type: :article_published,
             article_id: snapshot.article_id,
             title: snapshot.title,
             thread: snapshot.thread,
             read: false,
             from_users_count: 1,
             from_users: [Map.from_struct(snapshot.author)]
           })
           |> Ecto.Changeset.foreign_key_constraint(:article_id,
             name: :notifications_article_id_fkey
           )
           |> Repo.insert(),
         {:ok, :pass} <- Dedup.attach(key, notice) do
      {:ok, notice}
    else
      nil -> {:error, :first_publication_recipient_not_found}
      {:ok, :already_delivered} -> {:ok, :already_delivered}
      {:error, reason} -> {:error, reason}
    end
  end

  defp refresh_mailboxes([]), do: {:ok, []}

  defp refresh_mailboxes(notices) do
    notices
    |> Enum.map(& &1.user_id)
    |> Accounts.mailbox_update_status_many_in_transaction()
  end
end
