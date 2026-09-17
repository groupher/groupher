defmodule GroupherServer.CMS.ViewTracker.Query do
  @moduledoc """
  Batched authenticated viewer-state reads for Article responses.

      Article response -> Query batch -> projected state + pending overlay
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.ViewTracker.ErrorCat
  alias GroupherServer.CMS.ViewTracker.Model.{ViewEvent, ViewSummary, ViewerState}

  @doc "Reads current totals for already-authorized canonical Articles."
  @spec summaries(atom(), [struct()]) ::
          %{
            optional({atom(), integer()}) => %{
              views: non_neg_integer(),
              revision: non_neg_integer()
            }
          }
          | {:error, term()}
  def summaries(_thread, []), do: %{}

  def summaries(thread, articles) when is_atom(thread) and is_list(articles) do
    with {:ok, typed} <- typed_articles(articles),
         :ok <- validate_thread(typed, thread) do
      ids = Enum.map(typed, fn {_type, article} -> article.id end)

      rows =
        from(summary in ViewSummary,
          where: summary.thread == ^thread and summary.article_id in ^ids,
          select: {summary.article_id, summary.views, summary.revision}
        )
        |> Repo.all()
        |> Map.new(fn {id, views, revision} -> {id, %{views: views, revision: revision}} end)

      Map.new(typed, fn {_type, article} ->
        {{thread, article.id}, Map.get(rows, article.id, %{views: 0, revision: 0})}
      end)
    end
  end

  @doc "Orders an Article query by the independent current-view Summary projection."
  @spec order_by_views(Ecto.Queryable.t(), atom(), atom() | nil) :: Ecto.Query.t()
  def order_by_views(queryable, thread, order)
      when order in [:views, :most_views, :least_views] do
    thread_value = Atom.to_string(thread)
    direction = if order == :least_views, do: :asc, else: :desc

    queryable
    |> exclude(:order_by)
    |> then(fn query ->
      from(article in query,
        left_join: summary in ViewSummary,
        on: summary.thread == ^thread_value and summary.article_id == article.id,
        order_by: [{^direction, coalesce(summary.views, 0)}, desc: article.inserted_at]
      )
    end)
  end

  def order_by_views(queryable, _thread, _order), do: queryable

  @doc "Returns one viewer state through the same batched path used by lists."
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

  @doc "Returns viewer state keyed by `{article_type, article_id}` without per-Article queries."
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
          projected = projected_keys(keys, user_id)
          pending = pending_keys(keys, user_id)

          Enum.reduce(MapSet.union(projected, pending), base, fn key, states ->
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

  defp validate_thread(typed, thread) do
    if Enum.all?(typed, fn {article_thread, _article} -> article_thread == thread end),
      do: :ok,
      else: {:error, ErrorCat.unsupported_artiment()}
  end

  defp projected_keys(keys, user_id) do
    keys
    |> pair_query()
    |> where([state], state.user_id == ^user_id)
    |> select([state], {state.thread, state.article_id})
    |> Repo.all()
    |> MapSet.new()
  end

  defp pending_keys(keys, user_id) do
    keys
    |> pair_query(ViewEvent)
    |> where(
      [event],
      event.user_id == ^user_id and event.actor_type == :human and
        event.is_authenticated == true and
        event.projection_state == :pending and
        is_nil(event.projected_at) and event.counted == true
    )
    |> select([event], {event.thread, event.article_id})
    |> Repo.all()
    |> MapSet.new()
  end

  defp pair_query(keys, schema \\ ViewerState) do
    predicate =
      Enum.reduce(keys, dynamic(false), fn {type, id}, predicate ->
        dynamic([row], ^predicate or (row.thread == ^type and row.article_id == ^id))
      end)

    from(row in schema, where: ^predicate)
  end
end
