defmodule GroupherServer.CMS.SearchArtiments.Platforms.Algolia do
  @moduledoc "Algolia implementation of the Search Artiments platform contract."

  @behaviour GroupherServer.CMS.SearchArtiments.PlatformAdapter

  require Logger

  alias GroupherServer.CMS.SearchArtiments.{Artiment, Query, Result}

  @timeout 5_000
  @task_poll_interval 100
  @task_poll_attempts 50
  @default_max_plain_text_bytes 7_000

  @impl true
  def upsert([], _opts), do: :ok

  def upsert(artiments, opts) when is_list(artiments) do
    requests =
      Enum.map(artiments, fn artiment ->
        %{"action" => "addObject", "body" => platform_record(artiment)}
      end)

    admin_request(:post, "/1/indexes/#{index_name()}/batch", %{"requests" => requests},
      expected_object_ids: length(requests),
      wait_for_task: Keyword.get(opts, :wait_for_task, false)
    )
  end

  @impl true
  def delete([]), do: :ok

  def delete(refs) when is_list(refs) do
    requests =
      Enum.map(refs, fn ref ->
        %{"action" => "deleteObject", "body" => %{"objectID" => ref}}
      end)

    admin_request(:post, "/1/indexes/#{index_name()}/batch", %{"requests" => requests},
      expected_object_ids: length(requests)
    )
  end

  @impl true
  def update_metrics([]), do: :ok

  def update_metrics(updates) when is_list(updates) do
    requests =
      Enum.map(updates, fn {ref, metrics} ->
        %{
          "action" => "partialUpdateObjectNoCreate",
          "body" => metrics |> encode_metrics() |> Map.put("objectID", ref)
        }
      end)

    admin_request(:post, "/1/indexes/#{index_name()}/batch", %{"requests" => requests},
      expected_object_ids: length(requests)
    )
  end

  @impl true
  def search(%Query{sort: sort}) when sort != :relevance do
    {:error, {:custom, "Algolia sort replicas are not configured"}}
  end

  def search(%Query{} = query) do
    body = %{
      "query" => query.text,
      "page" => query.page - 1,
      "hitsPerPage" => query.size,
      "filters" => filters(query),
      "attributesToHighlight" => highlight_fields(query),
      "highlightPreTag" => "<mark>",
      "highlightPostTag" => "</mark>"
    }

    with {:ok, response} <- search_request(:post, "/1/indexes/#{index_name()}/query", body),
         {:ok, entries} <- decode_hits(response["hits"] || []) do
      {:ok,
       %Result{
         entries: entries,
         total_pages: response["nbPages"] || 0,
         total_count: response["nbHits"] || 0,
         page_size: response["hitsPerPage"] || query.size,
         page_number: (response["page"] || query.page - 1) + 1
       }}
    end
  end

  @doc "Applies the index settings required by Search Artiments."
  @spec configure_index() :: :ok | {:error, term()}
  def configure_index do
    settings = %{
      "searchableAttributes" => ["unordered(title)", "unordered(plainText)"],
      "attributesForFaceting" => [
        "filterOnly(type)",
        "filterOnly(thread)",
        "filterOnly(communityRef)",
        "filterOnly(articleRef)",
        "filterOnly(authorRef)",
        "filterOnly(locale)"
      ],
      "customRanking" => [
        "desc(contentAuthorityWeight)",
        "desc(upvotesCount)",
        "desc(commentsCount)",
        "desc(repliesCount)"
      ]
    }

    admin_request(:put, "/1/indexes/#{index_name()}/settings", settings, wait_for_task: true)
  end

  defp decode_hits(hits) do
    Enum.reduce_while(hits, {:ok, []}, fn hit, {:ok, acc} ->
      with {:ok, artiment} <- Artiment.from_platform_map(hit) do
        entry = %{artiment: artiment, highlights: decode_highlights(hit["_highlightResult"])}
        {:cont, {:ok, [entry | acc]}}
      else
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end

  defp decode_highlights(nil), do: []

  defp decode_highlights(result) do
    [
      highlight(:title, result["title"]),
      highlight(:plain_text, result["plainText"])
    ]
    |> Enum.reject(&is_nil/1)
  end

  defp highlight(_field, nil), do: nil
  defp highlight(field, %{"value" => value}), do: %{field: field, fragments: [value]}
  defp highlight(_field, _), do: nil

  defp filters(query) do
    [
      equality("communityRef", query.scope[:community_ref]),
      equality("articleRef", query.scope[:article_ref]),
      any_of("type", Enum.map(Query.types(query), &encode_enum/1)),
      any_of("thread", Enum.map(Query.threads(query), &encode_enum/1)),
      any_of("authorRef", query.filters[:author_refs]),
      any_of("locale", query.filters[:locales])
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.join(" AND ")
  end

  defp equality(_field, nil), do: nil
  defp equality(field, value), do: ~s(#{field}:"#{escape_filter(value)}")

  defp any_of(_field, []), do: nil

  defp any_of(field, values) do
    values
    |> Enum.map(&equality(field, &1))
    |> Enum.join(" OR ")
    |> then(&"(#{&1})")
  end

  defp escape_filter(value) do
    value
    |> to_string()
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
  end

  defp encode_enum(value), do: value |> Atom.to_string() |> String.upcase()

  defp highlight_fields(%Query{highlight: true}), do: ["title", "plainText"]
  defp highlight_fields(_), do: []

  defp platform_record(%Artiment{} = artiment) do
    max_bytes = Keyword.get(config(), :max_plain_text_bytes, @default_max_plain_text_bytes)
    {plain_text, truncated?} = truncate_utf8(artiment.plain_text, max_bytes)

    artiment
    |> Map.put(:plain_text, plain_text)
    |> Map.put(:plain_text_truncated, truncated?)
    |> Artiment.to_platform_map()
    |> Map.put("contentAuthorityWeight", authority_weight(artiment))
  end

  defp authority_weight(%Artiment{thread: thread}) when thread in [:doc, :changelog], do: 3
  defp authority_weight(%Artiment{type: :article}), do: 2
  defp authority_weight(_), do: 1

  defp truncate_utf8(text, max_bytes) when byte_size(text) <= max_bytes, do: {text, false}

  defp truncate_utf8(text, max_bytes) do
    truncated =
      text
      |> String.graphemes()
      |> Enum.reduce_while({[], 0}, fn grapheme, {acc, size} ->
        next_size = size + byte_size(grapheme)

        if next_size > max_bytes do
          {:halt, {acc, size}}
        else
          {:cont, {[grapheme | acc], next_size}}
        end
      end)
      |> elem(0)
      |> Enum.reverse()
      |> IO.iodata_to_binary()

    {truncated, true}
  end

  defp admin_request(method, path, body, opts) do
    result =
      case request(method, path, body, :admin_api_key, false) do
        {:ok, response} when is_map(response) ->
          with :ok <- validate_object_ids(response, Keyword.get(opts, :expected_object_ids)),
               {:ok, task_id} <- fetch_task_id(response),
               :ok <- maybe_wait_for_task(task_id, Keyword.get(opts, :wait_for_task, false)) do
            :ok
          end

        {:ok, response} ->
          {:error, {:search_platform, %{message: "invalid Algolia response", response: response}}}

        :ok ->
          {:error, {:search_platform, "empty Algolia admin response"}}

        error ->
          error
      end

    log_error(result, method, path)
    result
  end

  defp maybe_wait_for_task(task_id, true), do: wait_for_task(task_id, @task_poll_attempts)

  defp maybe_wait_for_task(task_id, false) do
    Logger.debug("Search platform task accepted",
      platform: :algolia,
      index: index_name(),
      task_id: task_id
    )

    :telemetry.execute(
      [:groupher, :search_artiments, :platform, :task],
      %{accepted: 1},
      %{platform: :algolia, index: index_name(), task_id: task_id, status: :accepted}
    )

    :ok
  end

  defp validate_object_ids(_response, nil), do: :ok

  defp validate_object_ids(%{"objectIDs" => object_ids}, expected)
       when is_list(object_ids) and length(object_ids) == expected,
       do: :ok

  defp validate_object_ids(response, expected) do
    {:error,
     {:search_platform,
      %{message: "unexpected Algolia batch response", expected: expected, response: response}}}
  end

  defp fetch_task_id(%{"taskID" => task_id}) when is_integer(task_id), do: {:ok, task_id}

  defp fetch_task_id(response) do
    {:error, {:search_platform, %{message: "missing Algolia taskID", response: response}}}
  end

  defp wait_for_task(_task_id, 0),
    do: {:error, {:search_platform, "timed out waiting for Algolia indexing task"}}

  defp wait_for_task(task_id, attempts_left) do
    case request(
           :get,
           "/1/indexes/#{index_name()}/task/#{task_id}",
           nil,
           :admin_api_key,
           false
         ) do
      {:ok, %{"status" => "published"}} ->
        :ok

      {:ok, %{"status" => "notPublished"}} ->
        Process.sleep(@task_poll_interval)
        wait_for_task(task_id, attempts_left - 1)

      {:ok, response} ->
        {:error,
         {:search_platform, %{message: "invalid Algolia task status", response: response}}}

      error ->
        error
    end
  end

  defp search_request(method, path, body) do
    result = request(method, path, body, :search_api_key, true)
    log_error(result, method, path)
    result
  end

  defp request(method, path, body, key_name, distributed?) do
    with {:ok, application_id} <- required_config(:application_id),
         {:ok, api_key} <- required_config(key_name) do
      host =
        if distributed?,
          do: "https://#{application_id}-dsn.algolia.net",
          else: "https://#{application_id}.algolia.net"

      client =
        Tesla.client([
          {Tesla.Middleware.BaseUrl, host},
          {Tesla.Middleware.Headers,
           [
             {"x-algolia-application-id", application_id},
             {"x-algolia-api-key", api_key}
           ]},
          {Tesla.Middleware.Retry, delay: 200, max_retries: 2},
          {Tesla.Middleware.Timeout, timeout: @timeout},
          {Tesla.Middleware.JSON, engine: Jason}
        ])

      client
      |> Tesla.request(method: method, url: path, body: body)
      |> parse_response()
    end
  end

  defp encode_metrics(metrics) do
    metrics
    |> Enum.reduce(%{}, fn
      {:upvotes_count, value}, acc ->
        Map.put(acc, "upvotesCount", value)

      {:comments_count, value}, acc ->
        Map.put(acc, "commentsCount", value)

      {:replies_count, value}, acc ->
        Map.put(acc, "repliesCount", value)

      {:updated_at, %DateTime{} = value}, acc ->
        Map.put(acc, "updatedAt", DateTime.to_iso8601(value))

      _, acc ->
        acc
    end)
  end

  defp log_error({:error, reason}, method, path) do
    Logger.warning("Search platform request failed",
      platform: :algolia,
      method: method,
      path: path,
      reason: inspect(reason)
    )
  end

  defp log_error(_result, _method, _path), do: :ok

  defp parse_response({:ok, %Tesla.Env{status: status, body: body}}) when status in 200..299 do
    if is_map(body), do: {:ok, body}, else: :ok
  end

  defp parse_response({:ok, %Tesla.Env{status: status, body: body}}) do
    {:error, {:search_platform, %{status: status, body: body}}}
  end

  defp parse_response({:error, reason}), do: {:error, {:search_platform, reason}}

  defp required_config(key) do
    case Keyword.get(config(), key) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, {:search_platform, "missing Algolia #{key}"}}
    end
  end

  defp index_name, do: Keyword.fetch!(config(), :index_name)

  defp config do
    :groupher_server
    |> Application.fetch_env!(:search_artiments)
    |> Keyword.fetch!(:algolia)
  end
end
