defmodule GroupherServer.CMS.Articles.Upvotes do
  @moduledoc """
  Article upvote helpers.
  """

  import GroupherServer.CMS.Artiment.Matcher
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.ArticleUpvote
  alias CMS.{Events, FrontDesk}
  alias Helper.{Multi, Later, ORM, T, Transaction}

  @spec upvoted_users(term(), map()) :: T.domain_res(term())
  def upvoted_users(article, filter),
    do: FrontDesk.load_reaction_users(ArticleUpvote, article, filter)

  @spec upvote(term(), User.t()) :: T.domain_res(term())
  def upvote(article, %User{} = user) do
    {:ok, info} = match(article)

    Transaction.lock_row(article, fn article ->
      Multi.new()
      |> Multi.run(:update_upvotes_count, fn _, _ ->
        ORM.inc(article, :upvotes_count)
      end)
      |> Multi.run(:update_reaction_user_list, fn _, %{update_upvotes_count: article} ->
        FrontDesk.update_article_reaction_user_list(:upvote, article, user, :add)
      end)
      |> Multi.run(:add_achievement, fn _, _ ->
        achiever_id = article.author.user_id
        Accounts.Achievements.achieve(%User{id: achiever_id}, :inc, :upvote)
      end)
      |> Multi.run(:create_upvote, fn _, %{update_reaction_user_list: article} ->
        create_upvote(article, info, user)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run({Events, :emit, [:notify_upvote, %{target: article, from_user: user}]})

        Later.run(
          {Events, :emit, [:subscribe_community, %{target: article.community, user: user}]}
        )
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec undo_upvote(term(), User.t()) :: T.domain_res(term())
  def undo_upvote(article, %User{id: user_id} = from_user) do
    {:ok, info} = match(article)

    Transaction.lock_row(article, fn article ->
      Multi.new()
      |> Multi.run(:find_upvote, fn _, _ ->
        args = Map.put(%{user_id: user_id}, info.foreign_key, article.id)

        case ORM.find_by(ArticleUpvote, args) do
          {:ok, record} -> {:ok, record}
          {:error, _} -> {:ok, nil}
        end
      end)
      |> Multi.run(:update_upvotes_count, fn _, %{find_upvote: record} ->
        case record do
          nil -> {:ok, article}
          _ -> ORM.dec(article, :upvotes_count)
        end
      end)
      |> Multi.run(:update_reaction_user_list, fn _, %{find_upvote: record} ->
        case record do
          nil -> {:ok, article}
          _ -> FrontDesk.update_article_reaction_user_list(:upvote, article, from_user, :remove)
        end
      end)
      |> Multi.run(:undo_upvote, fn _,
                                    %{find_upvote: record, update_reaction_user_list: updated} ->
        case record do
          nil ->
            {:ok, updated}

          _ ->
            args = Map.put(%{user_id: user_id}, info.foreign_key, article.id)
            ORM.findby_delete(ArticleUpvote, args)
            {:ok, updated}
        end
      end)
      |> Multi.run(:after_events, fn _, %{undo_upvote: updated} ->
        Later.run(
          {Events, :emit, [:notify_undo_upvote, %{target: updated, from_user: from_user}]}
        )
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  defp create_upvote(article, info, user) do
    {:ok, thread} = FrontDesk.thread_of(article)
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
