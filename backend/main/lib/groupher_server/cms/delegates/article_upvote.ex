defmodule GroupherServer.CMS.Delegate.ArticleUpvote do
  @moduledoc """
  reaction[upvote, collect, watch ...] on article [post, job...]
  """
  import GroupherServer.CMS.Helper.Matcher
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, thread_of: 2]

  import GroupherServer.CMS.Delegate.Helper,
    only: [
      load_reaction_users: 3,
      update_article_reaction_user_list: 4
    ]

  alias Helper.{ORM, Later, Transaction}
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.ArticleUpvote
  alias CMS.Delegate.Hooks

  alias Ecto.Multi

  @spec upvoted_users(term(), map()) :: T.domain_res(term())
  def upvoted_users(article, filter), do: load_reaction_users(ArticleUpvote, article, filter)

  @doc "upvote to a article-like content"
  @spec upvote_article(term(), User.t()) :: T.domain_res(term())
  def upvote_article(article, %User{} = user) do
    {:ok, info} = match(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:update_upvotes_count, fn _, _ ->
        ORM.inc(article, :upvotes_count)
      end)
      |> Multi.run(:update_reaction_user_list, fn _, %{update_upvotes_count: article} ->
        update_article_reaction_user_list(:upvote, article, user, :add)
      end)
      |> Multi.run(:add_achievement, fn _, _ ->
        achiever_id = article.author.user_id
        Accounts.achieve(%User{id: achiever_id}, :inc, :upvote)
      end)
      |> Multi.run(:create_upvote, fn _, %{update_reaction_user_list: article} ->
        create_upvote(article, info, user)
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        # comment this for test
        # Hooks.SubscribeCommunity.handle(article.community, from_user)
        Later.run({Hooks.Notify, :handle, [:upvote, article, user]})
        Later.run({Hooks.SubscribeCommunity, :handle, [article.community, user]})
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @doc "upvote to a article-like content"
  @spec undo_upvote_article(term(), User.t()) :: T.domain_res(term())
  def undo_upvote_article(article, %User{id: user_id} = from_user) do
    {:ok, info} = match(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:update_upvotes_count, fn _, _ ->
        ORM.dec(article, :upvotes_count)
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
    end)
  end

  defp create_upvote(article, info, user) do
    {:ok, thread} = thread_of(article, :upcase)
    args = Map.put(%{user_id: user.id, thread: thread}, info.foreign_key, article.id)

    case ORM.create(ArticleUpvote, args) do
      {:ok, _} -> article |> done
      _ -> {:error, {:already_upvoted, "viewer already upvoted"}}
    end
  end

  defp result({:ok, %{create_upvote: result}}), do: result |> done()
  defp result({:ok, %{undo_upvote: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}
end
