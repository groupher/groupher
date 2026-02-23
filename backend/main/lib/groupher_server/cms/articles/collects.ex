defmodule GroupherServer.CMS.Articles.Collects do
  @moduledoc """
  Article collect helpers.
  """

  import GroupherServer.CMS.Helper.Matcher
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.FrontDesk,
    only: [
      thread_of: 2,
      load_reaction_users: 3,
      update_article_reaction_user_list: 4
    ]

  alias Ecto.Multi
  alias Helper.{ORM, Later, Transaction}
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.ArticleCollect
  alias GroupherServer.CMS.Events

  @spec collected_users(term(), map()) :: T.domain_res(term())
  def collected_users(article, filter), do: load_reaction_users(ArticleCollect, article, filter)

  @spec collect(term(), User.t()) :: T.domain_res(term())
  def collect(article, %User{} = user) do
    {:ok, info} = match(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:inc_author_achieve, fn _, _ ->
        Accounts.achieve(article.author.user, :inc, :collect)
      end)
      |> Multi.run(:inc_article_collects_count, fn _, _ ->
        ORM.inc(article, :collects_count)
      end)
      |> Multi.run(:update_article_reaction_user_list, fn _, _ ->
        update_article_reaction_user_list(:collect, article, user, :add)
      end)
      |> Multi.run(:create_collect, fn _, _ ->
        {:ok, thread} = thread_of(article, :upcase)
        args = Map.put(%{user_id: user.id, thread: thread}, info.foreign_key, article.id)

        ORM.create(ArticleCollect, args)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run({Events.Notify, :handle, [:collect, article, user]})
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec collect_ifneed(term(), User.t()) :: T.domain_res(term())
  def collect_ifneed(article, %User{} = user) do
    findby_args = collection_findby_args(article, user.id)
    already_collected = ORM.find_by(ArticleCollect, findby_args)

    case already_collected do
      {:ok, article_collect} -> {:ok, article_collect}
      {:error, _} -> collect(article, user)
    end
  end

  @spec undo_collect(term(), User.t()) :: T.domain_res(term())
  def undo_collect(article, %User{} = user) do
    {:ok, info} = match(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:find_collect, fn _, _ ->
        find_collect_record(info, article, user.id)
      end)
      |> Multi.run(:dec_author_achieve, fn _, %{find_collect: record} ->
        maybe_dec_author_achieve(record, article)
      end)
      |> Multi.run(:inc_article_collects_count, fn _, %{find_collect: record} ->
        maybe_dec_collects_count(record, article)
      end)
      |> Multi.run(:update_article_reaction_user_list, fn _, %{find_collect: record} ->
        maybe_update_collect_user_list(record, article, user)
      end)
      |> Multi.run(:undo_collect, fn _, %{find_collect: record} ->
        maybe_undo_collect(record, article, info, user.id)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run({Events.Notify, :handle, [:undo, :collect, article, user]})
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  defp find_collect_record(info, article, user_id) do
    args = Map.put(%{user_id: user_id}, info.foreign_key, article.id)

    case ORM.find_by(ArticleCollect, args) do
      {:ok, record} -> {:ok, record}
      {:error, _} -> {:ok, nil}
    end
  end

  defp maybe_dec_author_achieve(nil, _article), do: {:ok, :pass}

  defp maybe_dec_author_achieve(_record, article) do
    Accounts.achieve(article.author.user, :dec, :collect)
  end

  defp maybe_dec_collects_count(nil, article), do: {:ok, article}
  defp maybe_dec_collects_count(_record, article), do: ORM.dec(article, :collects_count)

  defp maybe_update_collect_user_list(nil, article, _user), do: {:ok, article}

  defp maybe_update_collect_user_list(_record, article, user) do
    update_article_reaction_user_list(:collect, article, user, :remove)
  end

  defp maybe_undo_collect(nil, article, _info, _user_id), do: {:ok, article}

  defp maybe_undo_collect(_record, article, info, user_id) do
    args = Map.put(%{user_id: user_id}, info.foreign_key, article.id)
    ORM.findby_delete(ArticleCollect, args)
  end

  @spec undo_collect_ifneed(term(), User.t()) :: T.domain_res(term())
  def undo_collect_ifneed(
        %{author: %Ecto.Association.NotLoaded{}} = article,
        %User{} = user
      ) do
    article
    |> Repo.preload(author: :user)
    |> undo_collect_ifneed(user)
  end

  def undo_collect_ifneed(article, %User{} = user) do
    findby_args = collection_findby_args(article, user.id)

    with {:ok, article_collect} <- ORM.find_by(ArticleCollect, findby_args) do
      case length(article_collect.collect_folders) <= 1 do
        true -> undo_collect(article, user)
        false -> {:ok, article_collect}
      end
    end
  end

  @spec set_collect_folder(ArticleCollect.t(), term()) :: T.domain_res(term())
  def set_collect_folder(%ArticleCollect{} = collect, folder) do
    collect_folders = (collect.collect_folders ++ [folder]) |> Enum.uniq()

    ORM.update_embed(collect, :collect_folders, collect_folders)
  end

  @spec undo_set_collect_folder(ArticleCollect.t(), term()) :: T.domain_res(term())
  def undo_set_collect_folder(%ArticleCollect{} = collect, folder) do
    collect_folders = Enum.reject(collect.collect_folders, &(&1.id == folder.id))

    case collect_folders do
      [] ->
        {:ok, :pass}

      _ ->
        ORM.update_embed(collect, :collect_folders, collect_folders)
    end
  end

  defp collection_findby_args(article, user_id) do
    {:ok, info} = match(article)
    {:ok, thread} = thread_of(article, :upcase)

    %{thread: thread, user_id: user_id} |> Map.put(info.foreign_key, article.id)
  end

  defp result({:ok, %{create_collect: result}}), do: result |> done()
  defp result({:ok, %{undo_collect: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}
end
