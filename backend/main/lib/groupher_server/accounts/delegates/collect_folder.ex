defmodule GroupherServer.Accounts.Delegate.CollectFolder do
  @moduledoc """
  user collect folder related
  """
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher

  alias Helper.Types, as: T
  alias Helper.QueryBuilder

  import Helper.ErrorCode
  import Helper.Utils, only: [done: 1, get_config: 2]
  import GroupherServer.CMS.FrontDesk, only: [thread_of: 1]

  import ShortMaps

  alias Helper.ORM
  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.{CollectFolder, Embeds, User}
  alias CMS.Model.ArticleCollect

  alias Ecto.Multi

  # @max_article_count_per_collect_folder 300

  @default_meta Embeds.CollectFolderMeta.default_meta()
  @article_threads get_config(:article, :threads)

  @doc """
  list a user's not-private collect folders
  """
  def paged_collect_folders(user_id, filter) do
    query = CollectFolder |> where([c], c.user_id == ^user_id and not c.private)

    do_paged_collect_folders(filter, query)
  end

  @doc """
  list a owner's collect folders
  """
  def paged_collect_folders(user_id, filter, %User{id: cur_user_id}) do
    query =
      if cur_user_id == user_id,
        do: CollectFolder |> where([c], c.user_id == ^user_id),
        else: CollectFolder |> where([c], c.user_id == ^user_id and not c.private)

    do_paged_collect_folders(filter, query)
  end

  @doc """
  list article inside a collect folder
  """
  def paged_collect_folder_articles(folder_id, filter) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      case folder.private do
        true -> raise_error(:private_collect_folder, "#{folder.title} is private")
        false -> do_paged_collect_folder_articles(folder, filter)
      end
    end
  end

  def paged_collect_folder_articles(folder_id, filter, %User{id: cur_user_id}) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      is_valid_request =
        case folder.private do
          true -> folder.user_id == cur_user_id
          false -> true
        end

      case is_valid_request do
        false -> raise_error(:private_collect_folder, "#{folder.title} is private")
        true -> do_paged_collect_folder_articles(folder, filter)
      end
    end
  end

  defp do_paged_collect_folder_articles(folder, filter) do
    article_preload =
      @article_threads
      |> Enum.reduce([], fn thread, acc ->
        acc ++ Keyword.new([{thread, [author: :user]}])
      end)

    Repo.preload(folder.collects, article_preload)
    |> ORM.embeds_paginator(filter)
    |> ORM.extract_articles()
    |> done()
  end

  @doc """
  create a collect folder for articles
  """
  def create_collect_folder(%{title: title} = attrs, %User{id: user_id}) do
    case ORM.find_by(CollectFolder, ~m(user_id title)a) do
      {:error, _} ->
        last_updated = Timex.today() |> Timex.to_datetime()

        args =
          Map.merge(
            %{
              user_id: user_id,
              last_updated: last_updated,
              meta: @default_meta
            },
            attrs
          )

        CollectFolder |> ORM.create(args)

      {:ok, folder} ->
        raise_error(:already_exist, "#{folder.title} already exists")
    end
  end

  def update_collect_folder(folder_id, attrs) do
    with {:ok, folder} <- ORM.find(CollectFolder, folder_id) do
      last_updated = Timex.today() |> Timex.to_datetime()
      folder |> ORM.update(Map.merge(~m(last_updated)a, attrs))
    end
  end

  @doc """
  delete empty collect folder
  """
  @spec delete_collect_folder(T.id()) :: {:ok, CollectFolder.t()}
  def delete_collect_folder(id) do
    with {:ok, folder} <- ORM.find(CollectFolder, id) do
      is_folder_empty = Enum.empty?(folder.collects)

      case is_folder_empty do
        true -> CollectFolder |> ORM.find_delete!(id)
        false -> raise_error(:delete_no_empty_collect_folder, "#{folder.title} is not empty")
      end
    end
  end

  @doc """
  add article from collect folder
  """
  def add_to_collect(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         {:ok, _} <- article_not_collect_in_folder(article, folder.collects),
         # 是否是该 folder 的 owner ?
         true <- user.id == folder.user_id do
      Multi.new()
      |> Multi.run(:add_article_collect, fn _, _ ->
        CMS.Articles.collect_ifneed(article, user)
      end)
      |> Multi.run(:add_to_collect_folder, fn _, %{add_article_collect: article_collect} ->
        collects = [article_collect] ++ folder.collects
        update_folder_meta(thread, collects, folder)
      end)
      # order is important, otherwise the folder in article_collect is not the latest
      |> Multi.run(:set_article_collect_folder, fn _,
                                                   %{
                                                     add_article_collect: article_collect,
                                                     add_to_collect_folder: folder
                                                   } ->
        CMS.Articles.set_collect_folder(article_collect, folder)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  remove article from collect folder
  """
  def remove_from_collect(article, folder_id, %User{} = user) do
    with {:ok, thread} <- thread_of(article),
         {:ok, folder} <- ORM.find(CollectFolder, folder_id),
         # 是否是该 folder 的 owner ?
         true <- user.id == folder.user_id do
      Multi.new()
      |> Multi.run(:del_article_collect, fn _, _ ->
        CMS.Articles.undo_collect_ifneed(article, user)
      end)
      |> Multi.run(:rm_from_collect_folder, fn _, %{del_article_collect: article_collect} ->
        # 不能用 -- 语法，因为两个结构体的 meta 信息不同，摔。
        collects = Enum.reject(folder.collects, &(&1.id == article_collect.id))
        update_folder_meta(thread, collects, folder)
      end)
      # order is important, otherwise the folder in article_collect is not the latest
      |> Multi.run(:unset_article_collect_folder, fn _,
                                                     %{
                                                       del_article_collect: article_collect,
                                                       rm_from_collect_folder: folder
                                                     } ->
        CMS.Articles.undo_set_collect_folder(article_collect, folder)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec update_folder_meta(T.article_thread(), [ArticleCollect.t()], CollectFolder.t()) ::
          CollectFolder.t()
  defp update_folder_meta(thread, collects, folder) do
    total_count = length(collects)
    last_updated = Timex.today() |> Timex.to_datetime()

    thread_count = Enum.filter(collects, &(not is_nil(Map.get(&1, :"#{thread}_id")))) |> length

    threads_flag_map = %{"has_#{thread}": thread_count > 0}
    thread_count_map = %{"#{thread}_count": thread_count}

    meta =
      folder.meta
      |> Map.merge(threads_flag_map)
      |> Map.merge(thread_count_map)

    {:ok, folder} = ORM.update_meta(folder, meta)

    folder
    |> Ecto.Changeset.change(%{total_count: total_count, last_updated: last_updated})
    |> Ecto.Changeset.put_embed(:collects, collects)
    |> Repo.update()
  end

  # check if the article is already in this folder
  defp article_not_collect_in_folder(article, collects) do
    with {:ok, thread} <- thread_of(article),
         {:ok, info} <- match(thread) do
      already_collected =
        Enum.any?(collects, fn c ->
          article.id == Map.get(c, info.foreign_key)
        end)

      case already_collected do
        true -> raise_error(:already_collected_in_folder, "already collected in this folder")
        false -> {:ok, :pass}
      end
    end
  end

  defp do_paged_collect_folders(filter, query) do
    %{page: page, size: size} = filter

    query
    |> filter_thread_ifneed(filter)
    # delete thread in filter for now, otherwise it will crash querybuilder, because thread not exist on CollectFolder
    |> QueryBuilder.filter_pack(filter |> Map.delete(:thread))
    |> ORM.paginator(page: page, size: size)
    |> done()
  end

  defp filter_thread_ifneed(query, %{thread: thread}) do
    field_name = "has_#{thread}"
    field_value = true

    # see https://stackoverflow.com/a/55922528/4050784
    query
    |> where([f], fragment("(?->>?)::boolean = ?", f.meta, ^field_name, ^field_value))
  end

  defp filter_thread_ifneed(query, _), do: query

  defp result({:ok, %{add_to_collect_folder: result}}), do: {:ok, result}
  defp result({:ok, %{rm_from_collect_folder: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
