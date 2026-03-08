defmodule GroupherServer.Messaging.Mentions do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, atom_values_to_upcase: 1]
  import GroupherServer.CMS.FrontDesk, only: [thread_of: 2]
  import ShortMaps

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.User
  alias GroupherServer.CMS.Model.Comment
  alias GroupherServer.Messaging.Model.Mention
  alias Helper.{Multi, ORM}

  def send(_, [], _), do: {:ok, :pass}

  def send(%Comment{} = comment, mentions, %User{} = from_user) do
    Multi.new()
    |> Multi.run(:batch_delete_mentions, fn _, _ ->
      batch_delete_mentions(comment, from_user)
    end)
    |> Multi.run(:batch_insert_mentions, fn _, _ ->
      mentions = Enum.map(mentions, &atom_values_to_upcase(&1))

      case {0, nil} !== Repo.insert_all(Mention, mentions) do
        true -> {:ok, :pass}
        false -> {:error, "insert mentions error"}
      end
    end)
    |> Multi.run(:update_user_mailbox_status, fn _, _ ->
      Enum.each(mentions, &Accounts.Mailbox.update_status(&1.to_user_id)) |> done
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
      mentions =
        mentions
        |> Enum.map(&atom_values_to_upcase(&1))
        |> Enum.reject(&(&1.to_user_id == from_user.id))

      case Enum.empty?(mentions) or {0, nil} !== Repo.insert_all(Mention, mentions) do
        true -> {:ok, :pass}
        false -> {:error, "insert mentions error"}
      end
    end)
    |> Multi.run(:update_user_mailbox_status, fn _, _ ->
      Enum.each(mentions, &Accounts.Mailbox.update_status(&1.to_user_id)) |> done
    end)
    |> Repo.transaction()
    |> result()
  end

  def paged(%User{} = user, %{page: page, size: size} = filter) do
    read = Map.get(filter, :read, false)

    Mention
    |> where([m], m.to_user_id == ^user.id and m.read == ^read)
    |> ORM.paginator(~m(page size)a)
    |> extract_mentions
    |> done()
  end

  def unread_count(user_id) do
    Mention
    |> where([m], m.to_user_id == ^user_id and m.read == false)
    |> ORM.count()
  end

  def mark_read(ids, %User{} = user) when is_list(ids) do
    Mention
    |> where([m], m.id in ^ids and m.to_user_id == ^user.id and m.read == false)
    |> ORM.mark_read_all()
  end

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
    with {:ok, thread} <- thread_of(article, :upcase) do
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

  defp result({:ok, %{batch_insert_mentions: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
