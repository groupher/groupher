defmodule GroupherServer.CMS.Delegate.ArticleUpvote do
  @moduledoc """
  reaction[upvote, collect, watch ...] on article [post, job...]
  """
  import GroupherServer.CMS.Helper.Matcher
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, thread_of: 1, thread_of: 2, preload_author: 1]
  import Helper.ErrorCode

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
  alias CMS.Model.ArticleUpvote
  alias CMS.Delegate.Hooks

  alias Ecto.Multi

  def upvoted_users(article, filter), do: load_reaction_users(ArticleUpvote, article, filter)

  @doc "upvote to a article-like content"
  def upvote_article(article, %User{} = user) do
    {:ok, article} = preload_author(article)

    with {:ok, thread} = thread_of(article),
         {:ok, info} <- match(thread) do
      Multi.new()
      |> Multi.run(:update_upvotes_count, fn _, _ ->
        update_article_reactions_count(info, article, :upvotes_count, :inc)
      end)
      |> Multi.run(:update_reaction_user_list, fn _, %{update_upvotes_count: article} ->
        update_article_reaction_user_list(:upvote, article, user, :add)
      end)
      |> Multi.run(:add_achievement, fn _, _ ->
        achiever_id = article.author.user_id
        Accounts.achieve(%User{id: achiever_id}, :inc, :upvote)
      end)
      |> Multi.run(:create_upvote, fn _, %{update_reaction_user_list: article} ->
        {:ok, thread} = thread_of(article, :upcase)
        args = Map.put(%{user_id: user.id, thread: thread}, info.foreign_key, article.id)

        case ORM.create(ArticleUpvote, args) do
          {:ok, _} -> article |> done
          _ -> {:error, [message: "viewer already upvoted", code: ecode(:already_upvoted)]}
        end
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        # comment this for test
        # Hooks.SubscribeCommunity.handle(article.original_community, from_user)
        Later.run({Hooks.Notify, :handle, [:upvote, article, user]})
        Later.run({Hooks.SubscribeCommunity, :handle, [article.original_community, user]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc "upvote to a article-like content"
  def undo_upvote_article(article, %User{id: user_id} = from_user) do
    {:ok, article} = preload_author(article)

    with {:ok, thread} = thread_of(article),
         {:ok, info} <- match(thread) do
      Multi.new()
      |> Multi.run(:update_upvotes_count, fn _, _ ->
        update_article_reactions_count(info, article, :upvotes_count, :dec)
      end)
      |> Multi.run(:update_reaction_user_list, fn _, %{update_upvotes_count: article} ->
        update_article_reaction_user_list(:upvote, article, from_user, :remove)
      end)
      |> Multi.run(:undo_upvote, fn _, %{update_reaction_user_list: article} ->
        args = Map.put(%{user_id: user_id}, info.foreign_key, article.id)

        ORM.findby_delete(ArticleUpvote, args)
        article |> done
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        Later.run({Hooks.Notify, :handle, [:undo, :upvote, article, from_user]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp result({:ok, %{create_upvote: result}}), do: result |> done()
  defp result({:ok, %{undo_upvote: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}
end
