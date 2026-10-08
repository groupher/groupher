defmodule GroupherServer.CMS.Articles.Response do
  @moduledoc """
  Assembles public Article API presentation fields from Interaction read state.

  Interaction owns public projection reads; current-viewer state is exposed only
  through the dedicated private APIs.

      Articles Query -> Response -> Article API response
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Comments.BodyCodec
  alias CMS.Articles.Bindings
  alias CMS.Model.{Comment, PostSolution}

  @doc """
  Assembles one Article with public Interaction presentation fields.

  ## Examples

      Response.one(article, viewer)

  """
  @spec one(struct(), User.t() | nil, keyword()) :: {:ok, struct()} | {:error, term()}
  def one(article, _viewer, opts \\ []) do
    with state when is_map(state) <- CMS.Interactions.public_state(article, opts) do
      solution_by_post = solution_by_post([article])

      {:ok,
       article
       |> put_public_inner_id()
       |> merge_public_state(state)
       |> merge_solution(solution_by_post)
       |> CMS.ShadowSync.refresh_article()}
    end
  end

  @doc """
  Assembles one page of Articles from a batched Interaction read.

  ## Examples

      Response.list(articles, viewer)

  """
  @spec list([struct()], User.t() | nil, keyword()) :: {:ok, [struct()]} | {:error, term()}
  def list(articles, _viewer, opts \\ []) when is_list(articles) do
    with states when is_map(states) <- CMS.Interactions.public_states(articles, opts) do
      solution_by_post = solution_by_post(articles)

      articles =
        Enum.map(articles, fn article ->
          {:ok, %{artiment: type}} = Matcher.match_interaction(article)

          article
          |> put_public_inner_id()
          |> merge_public_state(Map.fetch!(states, {type, article.id}))
          |> merge_solution(solution_by_post)
        end)

      {:ok, CMS.ShadowSync.refresh_articles(articles)}
    end
  end

  defp solution_by_post(articles) do
    post_ids = for %{id: id, thread: :post} <- articles, do: id

    fetch_solutions(post_ids)
  end

  defp fetch_solutions([]), do: %{}

  defp fetch_solutions(post_ids) do
    PostSolution
    |> join(:inner, [solution], comment in Comment, on: comment.id == solution.comment_id)
    |> where([solution], solution.article_id in ^post_ids)
    |> select(
      [solution, comment],
      {solution.article_id, comment.inner_id, comment.body, comment.body_html}
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

  defp merge_solution(%{id: post_id, thread: :post} = post, solution_by_post) do
    case Map.get(solution_by_post, post_id) do
      nil ->
        post
        |> Map.put(:is_solved, false)
        |> Map.put(:solution_comment_id, nil)
        |> Map.put(:solution_digest, nil)

      %{comment_ref: comment_ref, digest: digest} ->
        post
        |> Map.put(:is_solved, true)
        |> Map.put(:solution_comment_id, comment_ref)
        |> Map.put(:solution_digest, digest)
    end
  end

  defp merge_solution(article, _solution_by_post), do: article

  defp put_public_inner_id(article) do
    case Bindings.get(article, Map.get(article, :community)) do
      {:ok, %{inner_id: inner_id}} -> Map.put(article, :inner_id, inner_id)
      _ -> article
    end
  end

  defp merge_public_state(article, state) do
    article
    |> Map.put(:meta, article_meta(article, state))
  end

  defp article_meta(article, state) do
    meta =
      (Map.get(article, :meta) || %{})
      |> Map.put(:latest_upvoted_users, state.latest_upvoted_users)
      |> Map.put(:latest_collected_users, state.latest_collected_users)

    Map.put(meta, :reported_count, Map.get(state, :reported_count, 0))
  end
end
