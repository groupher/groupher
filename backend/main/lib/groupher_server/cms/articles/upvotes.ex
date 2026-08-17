defmodule GroupherServer.CMS.Articles.Upvotes do
  @moduledoc """
  Article upvote helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Upvotes
        -> Repo / domain event
  """

  import GroupherServer.CMS.Artiment.Matcher
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{ArticleUpvote, Author}
  alias CMS.SearchArtiments.Indexer
  alias CMS.{Events, FrontDesk}
  alias CMS.Interactions.State
  alias Helper.{Multi, Later, ORM, T}

  @spec upvoted_users(term(), map()) :: T.domain_res(term())
  def upvoted_users(article, filter),
    do: FrontDesk.load_reaction_users(ArticleUpvote, article, filter)

  @spec upvote(term(), User.t()) :: T.domain_res(term())
  def upvote(article, %User{} = user) do
    {:ok, info} = match(article)

    Multi.new()
    |> Multi.run(:access_check, fn _, _ ->
      CMS.Gate.access_check(user, :upvote, article)
    end)
    |> Multi.run(:create_upvote, fn _, %{access_check: canonical_article} ->
      create_upvote(canonical_article, info, user)
    end)
    |> Multi.run(:sync_projection, fn _, %{access_check: canonical_article} ->
      State.write(canonical_article, :upvote, user, :add)
    end)
    |> Multi.run(:add_achievement, fn _, %{access_check: canonical_article} ->
      Accounts.Achievements.achieve(author_user(canonical_article), :inc, :upvote)
    end)
    |> Repo.transaction()
    |> result()
    |> emit_after_commit(:upvote, user)
    |> hydrate(user)
    |> sync_search_metrics()
  end

  @spec undo_upvote(term(), User.t()) :: T.domain_res(term())
  def undo_upvote(article, %User{id: user_id} = from_user) do
    {:ok, info} = match(article)

    Multi.new()
    |> Multi.run(:access_check, fn _, _ ->
      CMS.Gate.access_check(from_user, :upvote, article)
    end)
    |> Multi.run(:find_upvote, fn _, %{access_check: canonical_article} ->
      args = Map.put(%{user_id: user_id}, info.foreign_key, canonical_article.id)

      case ORM.find_by(ArticleUpvote, args) do
        {:ok, record} -> {:ok, record}
        {:error, _} -> {:ok, nil}
      end
    end)
    |> Multi.run(:undo_upvote, fn _, %{access_check: canonical_article, find_upvote: record} ->
      case record do
        nil ->
          {:ok, canonical_article}

        _ ->
          args = Map.put(%{user_id: user_id}, info.foreign_key, canonical_article.id)
          ORM.findby_delete(ArticleUpvote, args)
          {:ok, canonical_article}
      end
    end)
    |> Multi.run(:sync_projection, fn _,
                                      %{access_check: canonical_article, find_upvote: record} ->
      case record do
        nil -> {:ok, canonical_article}
        _ -> State.write(canonical_article, :upvote, from_user, :remove)
      end
    end)
    |> Repo.transaction()
    |> result()
    |> emit_after_commit(:undo_upvote, from_user)
    |> hydrate(from_user)
    |> sync_search_metrics()
  end

  defp create_upvote(article, info, user) do
    {:ok, thread} = FrontDesk.thread_of(article)
    args = Map.put(%{user_id: user.id, thread: thread}, info.foreign_key, article.id)

    case ORM.create(ArticleUpvote, args) do
      {:ok, _} -> article |> done
      _ -> {:error, {:already_upvoted, "viewer already upvoted"}}
    end
  end

  defp author_user(%{author: %{user_id: user_id}}), do: %User{id: user_id}
  defp author_user(%{author_id: author_id}), do: %User{id: Repo.get!(Author, author_id).user_id}

  defp result({:ok, %{create_upvote: result}}), do: result |> done()
  defp result({:ok, %{undo_upvote: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}

  defp emit_after_commit({:ok, article} = result, :upvote, user) do
    Later.run({Events, :emit, [:notify_upvote, %{target: article, from_user: user}]})

    Later.run(
      {Events, :emit, [:subscribe_community, %{target: article.community, user: user}]}
    )

    result
  end

  defp emit_after_commit({:ok, article} = result, :undo_upvote, user) do
    Later.run({Events, :emit, [:notify_undo_upvote, %{target: article, from_user: user}]})
    result
  end

  defp emit_after_commit(result, _action, _user), do: result

  defp sync_search_metrics({:ok, article} = result) do
    _ = Indexer.enqueue_metrics(article)
    result
  end

  defp sync_search_metrics(result), do: result

  defp hydrate({:ok, article}, user), do: {:ok, State.read(article, user)}
  defp hydrate(result, _user), do: result
end
