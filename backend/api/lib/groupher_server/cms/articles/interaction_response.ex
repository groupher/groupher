defmodule GroupherServer.CMS.Articles.InteractionResponse do
  @moduledoc """
  Assembles Article API response fields from Interaction read state.

  Interaction owns fact and viewer-state reads; Articles owns how that state is
  represented on the existing Article GraphQL response.

      Articles Reader -> InteractionResponse -> Article API response
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Comments.BodyCodec
  alias GroupherServer.CMS.Model.{Comment, Post, PostSolution}
  alias GroupherServer.Repo

  @doc """
  Assembles one Article with Interaction fields for the optional viewer.

  ## Examples

      InteractionResponse.one(article, viewer)

  """
  @spec one(struct(), User.t() | nil, keyword()) :: {:ok, struct()} | {:error, term()}
  def one(article, viewer, opts \\ []) do
    case CMS.Interactions.viewer_state(article, viewer, opts) do
      state when is_map(state) ->
        solution_by_post = solution_by_post([article])

        {:ok,
         article
         |> merge(state)
         |> merge_solution(solution_by_post)
         |> CMS.ShadowSync.refresh_article()}

      {:error, _reason} = error ->
        error
    end
  end

  @doc """
  Assembles one page of Articles from a batched Interaction read.

  ## Examples

      InteractionResponse.many(articles, viewer)

  """
  @spec many([struct()], User.t() | nil, keyword()) :: {:ok, [struct()]} | {:error, term()}
  def many(articles, viewer, opts \\ []) when is_list(articles) do
    with states when is_map(states) <- CMS.Interactions.viewer_states(articles, viewer, opts) do
      solution_by_post = solution_by_post(articles)

      articles =
        Enum.map(articles, fn article ->
          {:ok, %{artiment: type}} = Matcher.match_interaction(article)

          article
          |> merge(Map.fetch!(states, {type, article.id}))
          |> merge_solution(solution_by_post)
        end)

      {:ok, CMS.ShadowSync.refresh_articles(articles)}
    end
  end

  defp solution_by_post(articles) do
    post_ids = for %Post{id: id} <- articles, do: id

    fetch_solutions(post_ids)
  end

  defp fetch_solutions([]), do: %{}

  defp fetch_solutions(post_ids) do
    PostSolution
    |> join(:inner, [solution], comment in Comment, on: comment.id == solution.comment_id)
    |> where([solution], solution.post_id in ^post_ids)
    |> select(
      [solution, comment],
      {solution.post_id, comment.inner_id, comment.body, comment.body_html}
    )
    |> Repo.all()
    |> Map.new(fn {post_id, comment_ref, body, body_html} ->
      digest =
        case BodyCodec.parse(body) do
          {:ok, payload} -> payload.digest
          _ -> body_html
        end

      {post_id, %{comment_ref: comment_ref, digest: digest}}
    end)
  end

  defp merge_solution(%Post{id: post_id} = post, solution_by_post) do
    case Map.get(solution_by_post, post_id) do
      nil ->
        %{post | is_solved: false, solution_comment_id: nil, solution_digest: nil}

      %{comment_ref: comment_ref, digest: digest} ->
        %{post | is_solved: true, solution_comment_id: comment_ref, solution_digest: digest}
    end
  end

  defp merge_solution(article, _solution_by_post), do: article

  defp merge(article, state) do
    article
    |> Map.put(:upvotes_count, state.upvotes_count)
    |> Map.put(:collects_count, state.collects_count)
    |> Map.put(:viewer_has_upvoted, state.viewer_has_upvoted)
    |> Map.put(:viewer_has_collected, state.viewer_has_collected)
    |> Map.put(:viewer_has_reported, state.viewer_has_reported)
    |> Map.put(:viewer_has_viewed, state.viewer_has_viewed)
    |> Map.put(:emotions, emotion_map(state.emotions))
    |> Map.put(:meta, article_meta(article, state))
  end

  defp article_meta(article, state) do
    meta =
      (article.meta || %{})
      |> Map.put(:latest_upvoted_users, state.latest_upvoted_users)
      |> Map.put(:latest_collected_users, state.latest_collected_users)

    Map.put(meta, :reported_count, Map.get(state, :reported_count, 0))
  end

  defp emotion_map(emotions) do
    Map.new(emotions, fn emotion ->
      {emotion.emotion,
       %{
         count: emotion.count,
         latest_users: emotion.latest_users,
         viewer_has_reacted: emotion.viewer_has_reacted
       }}
    end)
    |> Enum.reduce(%{}, fn {emotion, state}, acc ->
      acc
      |> Map.put(:"#{emotion}_count", state.count)
      |> Map.put(:"latest_#{emotion}_users", state.latest_users)
      |> Map.put(:"viewer_has_#{emotion}ed", state.viewer_has_reacted)
    end)
  end
end
