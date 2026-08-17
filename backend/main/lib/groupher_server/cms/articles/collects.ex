defmodule GroupherServer.CMS.Articles.Collects do
  @moduledoc """
  Article collect helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Collects
        -> Repo / domain event
  """

  import GroupherServer.CMS.Artiment.Matcher
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{ArticleCollect, Author}
  alias CMS.{Events, FrontDesk}
  alias CMS.Interactions.State
  alias Helper.{Multi, Later, ORM, T}

  @spec collected_users(term(), map()) :: T.domain_res(term())
  def collected_users(article, filter),
    do: FrontDesk.load_reaction_users(ArticleCollect, article, filter)

  @spec collect(term(), User.t()) :: T.domain_res(term())
  def collect(article, %User{} = user) do
    {:ok, info} = match(article)

    Multi.new()
    |> Multi.run(:access_check, fn _, _ ->
      CMS.Gate.access_check(user, :collect, article)
    end)
    |> Multi.run(:create_collect, fn _, %{access_check: canonical_article} ->
      {:ok, thread} = FrontDesk.thread_of(canonical_article)
      args = Map.put(%{user_id: user.id, thread: thread}, info.foreign_key, canonical_article.id)

      ORM.create(ArticleCollect, args)
    end)
    |> Multi.run(:sync_projection, fn _, %{access_check: canonical_article} ->
      State.write(canonical_article, :collect, user, :add)
    end)
    |> Multi.run(:inc_author_achieve, fn _, %{access_check: canonical_article} ->
      Accounts.Achievements.achieve(author_user(canonical_article), :inc, :collect)
    end)
    |> Repo.transaction()
    |> result()
    |> emit_after_commit(:collect, user)
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

    Multi.new()
    |> Multi.run(:access_check, fn _, _ ->
      CMS.Gate.access_check(user, :collect, article)
    end)
    |> Multi.run(:find_collect, fn _, %{access_check: canonical_article} ->
      find_collect_record(info, canonical_article, user.id)
    end)
    |> Multi.run(:dec_author_achieve, fn _,
                                         %{access_check: canonical_article, find_collect: record} ->
      maybe_dec_author_achieve(record, canonical_article)
    end)
    |> Multi.run(:undo_collect, fn _, %{access_check: canonical_article, find_collect: record} ->
      maybe_undo_collect(record, canonical_article, info, user.id)
    end)
    |> Multi.run(:sync_projection, fn _,
                                      %{access_check: canonical_article, find_collect: record} ->
      case record do
        nil -> {:ok, canonical_article}
        _ -> State.write(canonical_article, :collect, user, :remove)
      end
    end)
    |> Repo.transaction()
    |> result()
    |> emit_after_commit(:undo_collect, user)
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
    Accounts.Achievements.achieve(author_user(article), :dec, :collect)
  end

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

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
    {:ok, thread} = FrontDesk.thread_of(article)

    %{thread: thread, user_id: user_id} |> Map.put(info.foreign_key, article.id)
  end

  defp result({:ok, %{create_collect: result}}), do: result |> done()
  defp result({:ok, %{undo_collect: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}

  defp emit_after_commit({:ok, article} = result, :collect, user) do
    Later.run({Events, :emit, [:notify_collect, %{article: article, from_user: user}]})
    result
  end

  defp emit_after_commit({:ok, article} = result, :undo_collect, user) do
    Later.run({Events, :emit, [:notify_undo_collect, %{article: article, from_user: user}]})
    result
  end

  defp emit_after_commit(result, _action, _user), do: result
end
