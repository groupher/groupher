defmodule GroupherServer.CMS.ViewTracker.Query do
  @moduledoc """
  Batched authenticated viewer-state reads for Article responses.

      Article response -> Query batch -> committed ViewerState
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Model.ArticleStats
  alias GroupherServer.CMS.ViewTracker.ErrorCat
  alias GroupherServer.CMS.ViewTracker.Model.ViewerState

  @doc """
  Orders an existing Article query by its public ArticleStats view count.

  The left join preserves Articles whose projection is absent and treats their
  count as zero. Unsupported order values leave the caller's query unchanged.
  """
  @spec order_by_views(Ecto.Queryable.t(), atom(), atom() | nil) :: Ecto.Query.t()
  def order_by_views(queryable, thread, order)
      when order in [:views, :most_views, :least_views] do
    thread_value = Atom.to_string(thread)
    direction = if order == :least_views, do: :asc, else: :desc

    queryable
    |> exclude(:order_by)
    |> then(fn query ->
      from(article in query,
        left_join: stats in ArticleStats,
        on: stats.thread == ^thread_value and stats.article_id == article.id,
        order_by: [{^direction, coalesce(stats.views, 0)}, asc: article.id]
      )
    end)
  end

  def order_by_views(queryable, _thread, _order), do: queryable

  @doc """
  Reads the ViewTracker-owned private state for one Article.

  This delegates to `viewer_states/3`, so detail and list reads share the same
  defaults and actor rules. The result contains only `viewer_has_viewed`;
  Interaction-owned fields are deliberately outside this module.
  """
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  def viewer_state(article, viewer, opts \\ []) do
    case viewer_states([article], viewer, opts) do
      states when is_map(states) ->
        {:ok, %{artiment: type}} = Matcher.match_interaction(article)
        Map.get(states, {type, article.id}, %{viewer_has_viewed: false})

      {:error, _reason} = error ->
        error

      _ ->
        {:error, ErrorCat.unsupported_artiment()}
    end
  end

  @doc """
  Reads ViewTracker-owned private state for a set of already-admitted Articles.

  The result is keyed by `{article_type, article_id}` and contains a default
  false entry for every input. Only an authenticated human can match persisted
  viewer rows; service agents and anonymous callers receive the defaults. The
  database lookup is batched rather than performed once per Article.
  """
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map() | {:error, term()}
  def viewer_states(articles, viewer, opts \\ [])

  def viewer_states([], _viewer, _opts), do: %{}

  def viewer_states(articles, viewer, opts) when is_list(articles) do
    with {:ok, typed} <- typed_articles(articles) do
      base =
        Map.new(typed, fn {type, article} ->
          {{type, article.id}, %{viewer_has_viewed: false}}
        end)

      actor_type = Keyword.get(opts, :actor_type, :human)

      case viewer do
        %User{id: user_id} when actor_type == :human ->
          keys = Enum.map(typed, fn {type, article} -> {type, article.id} end)

          Enum.reduce(projected_keys(keys, user_id), base, fn key, states ->
            Map.update!(states, key, &%{&1 | viewer_has_viewed: true})
          end)

        %User{} ->
          base

        nil ->
          base
      end
    end
  end

  defp typed_articles(articles) do
    Enum.reduce_while(articles, {:ok, []}, fn article, {:ok, acc} ->
      case Matcher.match_interaction(article) do
        {:ok, %{artiment: type}} ->
          if type in GroupherServer.CMS.Artiment.Threads.article_enums() do
            {:cont, {:ok, [{type, article} | acc]}}
          else
            {:halt, {:error, ErrorCat.unsupported_artiment()}}
          end

        _ ->
          {:halt, {:error, ErrorCat.unsupported_artiment()}}
      end
    end)
    |> case do
      {:ok, typed} -> {:ok, Enum.reverse(typed)}
      error -> error
    end
  end

  defp projected_keys(keys, user_id) do
    keys
    |> pair_query()
    |> where([state], state.user_id == ^user_id)
    |> select([state], {state.thread, state.article_id})
    |> Repo.all()
    |> MapSet.new()
  end

  defp pair_query(keys) do
    predicate =
      Enum.reduce(keys, dynamic(false), fn {type, id}, predicate ->
        dynamic([row], ^predicate or (row.thread == ^type and row.article_id == ^id))
      end)

    from(row in ViewerState, where: ^predicate)
  end
end
