defmodule GroupherServer.Analysis.MetricEvent do
  @moduledoc """
  Appends idempotent Analysis metric facts inside producer transactions.

      business mutation -> MetricEvent -> Aggregator
  """

  import Ecto.Query

  alias GroupherServer.{Analysis, CMS, Repo}
  alias Analysis.{Const, Model.MetricEvent}
  alias CMS.Artiment.Matcher
  alias CMS.Articles.Bindings

  @doc "Appends an Article action using the non-visitor `all` dimension."
  @spec append_article_action(map(), Ecto.UUID.t(), atom(), keyword()) ::
          :ok | {:error, term()}
  def append_article_action(article, operation_id, metric, opts \\ [])

  def append_article_action(%{id: _id} = article, operation_id, metric, opts) do
    with {:ok, %{artiment: article_type}} <- Matcher.match_interaction(article),
         {:ok, community_id} <- article_binding_id(article, opts),
         true <- article_type in CMS.Artiment.Threads.article_enums(),
         true <- metric in Const.metrics(),
         {:ok, _article_id} <- cast_article_id(Map.get(article, :id)) do
      append(%{
        operation_id: operation_id,
        community_id: community_id,
        article_type: article_type,
        article_id: article.id,
        metric: metric,
        actor_type: :all,
        is_authenticated: false,
        policy_version: 0,
        occurred_at: Keyword.get(opts, :occurred_at, DateTime.utc_now(:second))
      })
    else
      _ -> {:error, :invalid_article_metric}
    end
  end

  def append_article_action(_article, _operation_id, _metric, _opts) do
    {:error, :invalid_article_metric}
  end

  defp article_binding_id(article, opts) do
    case Keyword.get(opts, :community_id) do
      community_id when is_integer(community_id) ->
        {:ok, community_id}

      _ ->
        case Bindings.get(article, Map.get(article, :community)) do
          {:ok, %{community: %{id: community_id}}} -> {:ok, community_id}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  @doc "Appends one metric fact; duplicate producer retries are successful no-ops."
  @spec append(map()) :: {:ok, :pass} | {:error, term()}
  def append(attrs) when is_map(attrs) do
    attrs = Map.merge(defaults(), attrs)

    with {:ok, _} <- validate(attrs) do
      case Repo.insert_all(MetricEvent, [attrs],
             on_conflict: :nothing,
             conflict_target: [:operation_id, :metric]
           ) do
        {1, _rows} -> {:ok, :pass}
        {0, _rows} -> {:ok, :pass}
        result -> {:error, {:metric_event_insert_failed, result}}
      end
    end
  end

  @doc "Marks metric events as failed for operational retry inspection."
  @spec record_failure([Ecto.UUID.t()], term()) :: {:ok, :pass}
  def record_failure(ids, reason) when is_list(ids) do
    Repo.update_all(
      from(event in MetricEvent, where: event.id in ^ids),
      set: [last_error: inspect(reason)],
      inc: [attempts: 1]
    )

    {:ok, :pass}
  end

  defp defaults do
    now = DateTime.utc_now(:second)

    %{
      value: 1,
      actor_type: :all,
      is_authenticated: false,
      policy_version: 0,
      occurred_at: now,
      inserted_at: now,
      updated_at: now
    }
  end

  defp validate(%{
         operation_id: operation_id,
         article_type: article_type,
         metric: metric,
         actor_type: actor_type,
         is_authenticated: is_authenticated
       }) do
    cond do
      Ecto.UUID.cast(operation_id) == :error -> {:error, :invalid_operation_id}
      article_type not in CMS.Artiment.Threads.article_enums() -> {:error, :invalid_article_type}
      metric not in Const.metrics() -> {:error, :invalid_metric}
      actor_type not in Const.actor_dimensions() -> {:error, :invalid_actor_type}
      not is_boolean(is_authenticated) -> {:error, :invalid_authentication_flag}
      true -> {:ok, :pass}
    end
  end

  defp validate(_attrs), do: {:error, :invalid_metric_event}

  defp cast_article_id(id) when is_integer(id) and id > 0, do: {:ok, id}
  defp cast_article_id(id) when is_binary(id), do: Ecto.UUID.cast(id)
  defp cast_article_id(_id), do: :error
end
