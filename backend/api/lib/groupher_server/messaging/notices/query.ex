defmodule GroupherServer.Messaging.Notices.Query do
  @moduledoc """
  Reads grouped activity notifications and unread counts.

  Persistence and grouping mutation are owned by `Notices.Persist`; this
  module is read-only.

      Notice rows -> Notices.Query -> Inbox
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.Accounts

  alias GroupherServer.{Messaging, Repo}
  alias Accounts.Model.User
  alias Messaging.Model.Notice
  alias Helper.ORM
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @cut_from_users_count 3

  @doc """
  Returns one page of activity notifications for a user.

  ## Examples

      Messaging.Notices.Query.paged(user, %{read: false}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  @spec paged(User.t(), map(), Params.t() | nil) :: term()
  def paged(%User{} = user, filter, pagi) do
    read = Map.get(filter, :read, false)

    query =
      Notice
      |> where([n], n.user_id == ^user.id and n.read == ^read)

    with {:ok, page} <-
           ORM.pagi(
             query,
             pagi,
             for: Notice,
             surface: "mailbox.notices",
             query_fingerprint:
               :crypto.hash(:sha256, :erlang.term_to_binary({user.id, read})) |> Base.encode16(),
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [:desc, :desc],
               cursor_fields: [:inserted_at, :id]
             }
           ) do
      page
      |> cut_from_users_ifneed()
      |> done()
    end
  end

  @doc """
  Counts unread activity notifications for one user.

  ## Examples

      Messaging.Notices.Query.unread_count(user.id)
  """
  @spec unread_count(term()) :: {:ok, non_neg_integer()} | {:error, term()}
  def unread_count(user_id) do
    Notice
    |> where([n], n.user_id == ^user_id and n.read == false)
    |> ORM.count()
  end

  @doc """
  Counts unread notifications grouped by recipient.

  ## Examples

      Messaging.Notices.Query.unread_counts([user.id])
  """
  @spec unread_counts([term()]) :: {:ok, map()} | {:error, term()}
  def unread_counts(user_ids) when is_list(user_ids) do
    Notice
    |> where([n], n.user_id in ^user_ids and n.read == false)
    |> group_by([n], n.user_id)
    |> select([n], {n.user_id, count(n.id)})
    |> Repo.all()
    |> Map.new()
    |> done()
  end

  defp cut_from_users_ifneed(%{entries: entries} = paged_contents) do
    entries =
      Enum.map(entries, fn notify ->
        Map.put(notify, :from_users, Enum.slice(notify.from_users, 0, @cut_from_users_count))
      end)

    Map.put(paged_contents, :entries, entries)
  end
end
