defmodule GroupherServer.CMS.Delegate.ArticleCollect do
  @moduledoc """
  reaction[upvote, collect, watch ...] on article [post, job...]
  """
  import GroupherServer.CMS.Helper.Matcher
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, thread_of: 2]

  import GroupherServer.CMS.Delegate.Helper,
    only: [
      load_reaction_users: 3,
      update_article_reactions_count: 4,
      update_article_reaction_user_list: 4
    ]

  # import Helper.ErrorCode
  alias Helper.{ORM, Later}
  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.ArticleCollect
  alias CMS.Delegate.Hooks

  alias Ecto.Multi

  @doc """
  get paged collected users
  """
  def collected_users(article, filter), do: load_reaction_users(ArticleCollect, article, filter)

  @doc """
  collect an article
  """
  def collect_article(article, %User{} = user) do
    with {:ok, info} <- match(article),
         {:ok, article} <- ORM.reload(article) do
      Multi.new()
      |> Multi.run(:inc_author_achieve, fn _, _ ->
        Accounts.achieve(article.author.user, :inc, :collect)
      end)
      |> Multi.run(:inc_article_collects_count, fn _, _ ->
        update_article_reactions_count(info, article, :collects_count, :inc)
      end)
      |> Multi.run(:update_article_reaction_user_list, fn _, _ ->
        update_article_reaction_user_list(:collect, article, user, :add)
      end)
      |> Multi.run(:create_collect, fn _, _ ->
        {:ok, thread} = thread_of(article, :upcase)
        args = Map.put(%{user_id: user.id, thread: thread}, info.foreign_key, article.id)

        ORM.create(ArticleCollect, args)
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        Later.run({Hooks.Notify, :handle, [:collect, article, user]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  # 用于在收藏时，用户添加文章到不同的收藏夹中的情况
  # 如果是同一篇文章，只创建一次，collect_article 不创建记录，只是后续设置不同的收藏夹即可
  # 如果是第一次收藏，那么才创建文章收藏记录
  # 避免因为同一篇文章在不同收藏夹内造成的统计和用户成就系统的混乱
  def collect_article_ifneed(article, %User{} = user) do
    with {:ok, info} <- match(article),
         {:ok, article} <- ORM.reload(article),
         findby_args <- collection_findby_args(article, user.id) do
      already_collected = ORM.find_by(ArticleCollect, findby_args)

      case already_collected do
        {:ok, article_collect} -> {:ok, article_collect}
        {:error, _} -> collect_article(article, user)
      end
    end
  end

  def undo_collect_article(article, %User{} = user) do
    with {:ok, info} <- match(article),
         {:ok, article} <- ORM.reload(article) do
      Multi.new()
      |> Multi.run(:dec_author_achieve, fn _, _ ->
        Accounts.achieve(article.author.user, :dec, :collect)
      end)
      |> Multi.run(:inc_article_collects_count, fn _, _ ->
        update_article_reactions_count(info, article, :collects_count, :dec)
      end)
      |> Multi.run(:update_article_reaction_user_list, fn _, _ ->
        update_article_reaction_user_list(:collect, article, user, :remove)
      end)
      |> Multi.run(:undo_collect, fn _, _ ->
        args = Map.put(%{user_id: user.id}, info.foreign_key, article.id)

        ORM.findby_delete(ArticleCollect, args)
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        Later.run({Hooks.Notify, :handle, [:undo, :collect, article, user]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def undo_collect_article_ifneed(
        %{author: %Ecto.Association.NotLoaded{}} = article,
        %User{} = user
      ) do
    article
    |> Repo.preload(author: :user)
    |> undo_collect_article_ifneed(user)
  end

  def undo_collect_article_ifneed(article, %User{} = user) do
    with findby_args <- collection_findby_args(article, user.id),
         {:ok, article_collect} = ORM.find_by(ArticleCollect, findby_args) do
      case article_collect.collect_folders |> length <= 1 do
        true -> undo_collect_article(article, user)
        false -> {:ok, article_collect}
      end
    end
  end

  def set_collect_folder(%ArticleCollect{} = collect, folder) do
    collect_folders = (collect.collect_folders ++ [folder]) |> Enum.uniq()

    ORM.update_embed(collect, :collect_folders, collect_folders)
  end

  def undo_set_collect_folder(%ArticleCollect{} = collect, folder) do
    collect_folders = Enum.reject(collect.collect_folders, &(&1.id == folder.id))

    case collect_folders do
      # means collect already delete
      [] ->
        {:ok, :pass}

      _ ->
        ORM.update_embed(collect, :collect_folders, collect_folders)
    end
  end

  defp collection_findby_args(article, user_id) do
    with {:ok, info} <- match(article),
         {:ok, thread} = thread_of(article, :upcase) do
      %{thread: thread, user_id: user_id} |> Map.put(info.foreign_key, article.id)
    end
  end

  #############
  defp result({:ok, %{create_collect: result}}), do: result |> done()
  defp result({:ok, %{undo_collect: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}
end
