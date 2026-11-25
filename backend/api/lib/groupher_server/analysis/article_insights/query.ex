defmodule GroupherServer.Analysis.ArticleInsights.Query do
  @moduledoc """
  Reads Article business metrics from the hourly Analysis projection.

  This boundary authorizes the Article with CMS Gate and never scans raw metric
  events. ViewTracker owns visitor classification; Analysis owns the trend DTO.

      Article query -> Gate scope -> hourly projection -> trend DTO
  """

  import Ecto.Query

  alias GroupherServer.{Analysis, CMS, Repo}
  alias Analysis.{Const, Model.ArticleHourlyMetric}

  @default_hours 48
  @max_buckets 720

  @doc """
  Returns an authorized Article hourly trend with zero-filled buckets.

  ## Examples

      Analysis.ArticleInsights.trend(article, viewer, metrics: [:views])
  """
  @spec trend(map(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  def trend(article, viewer, opts \\ [])

  def trend(%{id: _id} = article, viewer, opts) when is_list(opts) do
    with {:ok, article_type} <- CMS.article_insights_type(article),
         {:ok, _} <- authorize_if_needed(article, viewer, article_type, opts),
         {:ok, metrics} <- requested_metrics(opts),
         {:ok, actor_types} <- requested_actor_types(opts),
         {:ok, is_authenticated} <- requested_authentication(opts),
         {:ok, range} <- requested_range(opts),
         {:ok, binding} <- resolve_binding(article, opts),
         rows <-
           fetch_rows(
             binding.community_id,
             binding.id,
             article_type,
             article.id,
             metrics,
             actor_types,
             is_authenticated,
             range
           ) do
      {:ok, build_result(range, metrics, rows)}
    end
  end

  def trend(_article, _viewer, _opts), do: {:error, :invalid_article_insights_request}

  @doc """
  Resolves a public Article path through the Insights Gate scope and returns its trend.

  ## Examples

      Analysis.ArticleInsights.trend_by_path(%{community: "groupher", thread: :post, inner_id: 1}, viewer, [])
  """
  @spec trend_by_path(map(), term(), keyword()) :: {:ok, map()} | {:error, term()}
  def trend_by_path(article_path, viewer, opts \\ [])

  def trend_by_path(article_path, viewer, opts) when is_list(opts) do
    case CMS.resolve_article_for_insights(article_path, viewer, opts) do
      {:ok, article} ->
        opts =
          opts
          |> Keyword.put(:skip_authorize, true)
          |> Keyword.put(
            :community,
            Map.get(article_path, :community) || Map.get(article_path, "community")
          )

        trend(article, viewer, opts)

      {:error, _reason} = error ->
        error
    end
  end

  def trend_by_path(_article_path, _viewer, _opts) do
    {:error, :invalid_article_insights_request}
  end

  @doc """
  Normalizes the public Insights filter and derives viewer Passport scope.

  ## Examples

      Analysis.ArticleInsights.trend_by_public_filter(article_path, viewer, %{metrics: [:views]})
  """
  @spec trend_by_public_filter(map(), term(), map()) ::
          {:ok, map()} | {:error, term()}
  def trend_by_public_filter(article_path, viewer, filter) when is_map(filter) do
    with {:ok, granted_slugs} <- passport_granted_community_slugs(viewer) do
      opts =
        [
          from: Map.get(filter, :from),
          to: Map.get(filter, :to),
          metrics: Map.get(filter, :metrics),
          actor_types: Map.get(filter, :actor_types),
          is_authenticated: Map.get(filter, :is_authenticated),
          passport_granted_community_slugs: granted_slugs
        ]
        |> Enum.reject(fn {_key, value} -> is_nil(value) end)

      trend_by_path(article_path, viewer, opts)
    end
  end

  @doc """
  Returns the current closed metric vocabulary for Article Insights.

  ## Examples

      Analysis.ArticleInsights.metrics()
  """
  def metrics, do: Const.metrics()

  @doc "Returns the communities where the viewer has the Insights Passport grant."
  @spec passport_granted_community_slugs(term()) :: {:ok, [String.t()]} | {:error, term()}
  defdelegate passport_granted_community_slugs(viewer),
    to: CMS,
    as: :insights_granted_community_slugs

  defp authorize_if_needed(article, viewer, article_type, opts) do
    if Keyword.get(opts, :skip_authorize, false) do
      {:ok, :pass}
    else
      CMS.authorize_article_insights(article, viewer, article_type, opts)
    end
  end

  defp requested_metrics(opts) do
    metrics = Keyword.get(opts, :metrics, Const.metrics())

    if is_list(metrics) and Enum.all?(metrics, &(&1 in Const.metrics())) do
      {:ok, Enum.uniq(metrics)}
    else
      {:error, :invalid_insights_metric}
    end
  end

  defp requested_actor_types(opts) do
    case Keyword.fetch(opts, :actor_types) do
      :error ->
        {:ok, nil}

      {:ok, nil} ->
        {:ok, nil}

      {:ok, kinds} when is_list(kinds) ->
        dimensions = GroupherServer.RequestActor.const_actor_types()

        if Enum.all?(kinds, &(&1 in dimensions)) do
          {:ok, Enum.uniq(kinds)}
        else
          {:error, :invalid_insights_actor_type}
        end

      _ ->
        {:error, :invalid_insights_actor_type}
    end
  end

  defp requested_authentication(opts) do
    case Keyword.fetch(opts, :is_authenticated) do
      :error -> {:ok, nil}
      {:ok, value} when is_boolean(value) -> {:ok, value}
      _ -> {:error, :invalid_insights_authentication_filter}
    end
  end

  defp requested_range(opts) do
    now = DateTime.utc_now(:second)
    from = Keyword.get(opts, :from, DateTime.add(now, -@default_hours, :hour))
    to = Keyword.get(opts, :to, now)

    with true <- match?(%DateTime{}, from),
         true <- match?(%DateTime{}, to),
         :gt <- DateTime.compare(to, from) do
      start_bucket = hour_start(from)
      end_bucket = hour_start(to)

      end_bucket =
        if DateTime.compare(end_bucket, start_bucket) == :eq,
          do: DateTime.add(end_bucket, 3600, :second),
          else: end_bucket

      if DateTime.diff(end_bucket, start_bucket, :hour) <= @max_buckets do
        {:ok, %{from: start_bucket, to: end_bucket}}
      else
        {:error, :insights_range_too_large}
      end
    else
      _ -> {:error, :invalid_insights_range}
    end
  end

  defp fetch_rows(
         community_id,
         binding_id,
         article_type,
         article_id,
         metrics,
         actor_types,
         is_authenticated,
         %{from: from, to: to}
       ) do
    query =
      from(row in ArticleHourlyMetric,
        where:
          row.community_id == ^community_id and
            row.binding_id == ^binding_id and
            row.article_type == ^article_type and
            row.article_id == ^article_id and
            row.bucket_started_at >= ^from and
            row.bucket_started_at < ^to and
            row.metric in ^metrics,
        select: %{
          bucket_started_at: row.bucket_started_at,
          metric: row.metric,
          actor_type: row.actor_type,
          is_authenticated: row.is_authenticated,
          policy_version: row.policy_version,
          value: row.value
        }
      )

    view_dimension_filter = view_dimension_filter(actor_types, is_authenticated)

    metric_filter = dynamic([row], row.metric != ^:article_view or ^view_dimension_filter)

    from(row in query, where: ^metric_filter)
    |> Repo.all()
  end

  defp view_dimension_filter(nil, nil), do: dynamic([row], true)

  defp view_dimension_filter(actor_types, is_authenticated) do
    actor_filter = actor_dimension_filter(actor_types)
    auth_filter = authentication_dimension_filter(is_authenticated)
    dynamic([row], ^actor_filter and ^auth_filter)
  end

  defp actor_dimension_filter(nil), do: dynamic([row], true)
  defp actor_dimension_filter(types), do: dynamic([row], row.actor_type in ^types)

  defp authentication_dimension_filter(nil), do: dynamic([row], true)

  defp authentication_dimension_filter(is_authenticated) do
    dynamic([row], row.is_authenticated == ^is_authenticated)
  end

  defp resolve_binding(article, opts) do
    requested_community = Keyword.get(opts, :community)

    with {:ok, bindings} <- CMS.articles_bindings_all(article) do
      matches =
        case requested_community do
          nil -> bindings
          ref -> Enum.filter(bindings, &community_matches?(&1.community, ref))
        end

      case matches do
        [%{id: binding_id, community_id: community_id} = binding]
        when is_integer(binding_id) and is_integer(community_id) ->
          {:ok, binding}

        _ ->
          {:error, :article_insights_community_required}
      end
    end
  end

  defp community_matches?(community, ref) do
    to_string(community.slug) == to_string(ref) or
      (not is_nil(community.aka) and to_string(community.aka) == to_string(ref))
  end

  defp build_result(%{from: from, to: to} = range, metrics, rows) do
    grouped =
      Enum.group_by(rows, &{&1.bucket_started_at, &1.metric})
      |> Map.new(fn {key, values} ->
        total = Enum.reduce(values, 0, &(&1.value + &2))
        versions = values |> Enum.map(& &1.policy_version) |> Enum.uniq() |> Enum.sort()
        {key, %{value: total, policy_versions: versions}}
      end)

    items =
      from
      |> buckets_until(to)
      |> Enum.map(fn bucket ->
        bucket_metrics =
          Map.new(metrics, fn metric ->
            case Map.get(grouped, {bucket, metric}) do
              nil -> {metric, %{value: 0, policy_versions: []}}
              value -> {metric, value}
            end
          end)

        %{bucket_started_at: bucket, metrics: bucket_metrics}
      end)

    policy_versions =
      rows
      |> Enum.map(& &1.policy_version)
      |> Enum.uniq()
      |> Enum.sort()

    %{
      interval: :hour,
      from: range.from,
      to: range.to,
      items: items,
      policy_versions: policy_versions,
      has_mixed_policy: length(policy_versions) > 1
    }
  end

  defp buckets_until(from, to) do
    count = div(DateTime.diff(to, from, :second), 3600)

    Enum.map(0..(count - 1), &DateTime.add(from, &1 * 3600, :second))
  end

  defp hour_start(%DateTime{} = datetime) do
    DateTime.from_unix!(div(DateTime.to_unix(datetime), 3600) * 3600)
  end
end
