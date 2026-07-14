defmodule GroupherServer.CMS.ContentImport.Platforms.GitHub.Releases do
  @moduledoc "Fetches GitHub Releases into immutable record Entries."

  @behaviour GroupherServer.CMS.ContentImport.PlatformAdapter

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Entry, Snapshot}
  alias GroupherServer.CMS.ContentImport.Platforms.GitHub.Client

  @default_limit 100
  @max_limit 1_000

  @impl true
  def validate_connection(connection, _opts) when is_map(connection) do
    with {:ok, _owner} <- required_string(connection, :owner),
         {:ok, _repo} <- required_string(connection, :repo),
         :ok <- validate_boolean(connection, :include_drafts, false),
         :ok <- validate_boolean(connection, :include_prereleases, false),
         :ok <- validate_limit(value(connection, :limit, @default_limit)) do
      :ok
    end
  end

  def validate_connection(_connection, _opts) do
    Diagnostic.error_result(
      "invalid_github_releases_connection",
      "GitHub Releases connection must be a map"
    )
  end

  @impl true
  def fetch(connection, opts) do
    client = Keyword.get(opts, :client, Client)

    with :ok <- validate_connection(connection, opts),
         {:ok, releases} <- client.fetch_releases(connection, opts),
         {:ok, entries} <- build_entries(releases, connection) do
      Snapshot.new(%{
        platform: :github_releases,
        source_ref: source_ref(connection),
        revision: snapshot_revision(entries),
        checkpoint: checkpoint(entries),
        entries: entries,
        fetched_at: Keyword.get(opts, :fetched_at, DateTime.utc_now()),
        adapter_version: "1"
      })
    end
  end

  defp build_entries(releases, connection) when is_list(releases) do
    releases
    |> Enum.filter(&included?(&1, connection))
    |> Enum.take(value(connection, :limit, @default_limit))
    |> Enum.reduce_while({:ok, []}, fn release, {:ok, entries} ->
      case build_entry(release) do
        {:ok, entry} -> {:cont, {:ok, [entry | entries]}}
        {:error, diagnostic} -> {:halt, {:error, diagnostic}}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end

  defp build_entries(_releases, _connection) do
    Diagnostic.error_result(
      "github_releases_invalid_response",
      "GitHub releases response must be a list"
    )
  end

  defp build_entry(release) when is_map(release) do
    with {:ok, id} <- release_id(release),
         {:ok, tag_name} <- required_release_string(release, "tag_name"),
         {:ok, updated_at} <- release_datetime(release, "updated_at") do
      title = non_empty(release["name"]) || tag_name
      body = if is_binary(release["body"]), do: release["body"], else: ""

      Entry.new(%{
        external_ref: "github_release:#{id}",
        kind: :record,
        title: title,
        body: body,
        body_format: :md,
        source_url: release["html_url"],
        source_updated_at: updated_at,
        revision: DateTime.to_iso8601(updated_at),
        metadata: %{
          "github_release_id" => id,
          "tag_name" => tag_name,
          "draft" => release["draft"] == true,
          "prerelease" => release["prerelease"] == true,
          "published_at" => release["published_at"],
          "created_at" => release["created_at"]
        }
      })
    end
  end

  defp build_entry(_release) do
    Diagnostic.error_result("github_release_invalid", "GitHub release must be a map")
  end

  defp included?(release, connection) do
    include_drafts = value(connection, :include_drafts, false)
    include_prereleases = value(connection, :include_prereleases, false)

    (include_drafts or release["draft"] != true) and
      (include_prereleases or release["prerelease"] != true)
  end

  defp snapshot_revision([]), do: nil

  defp snapshot_revision(entries) do
    entry = Enum.max_by(entries, &DateTime.to_unix(&1.source_updated_at, :microsecond))
    "#{DateTime.to_iso8601(entry.source_updated_at)}:#{entry.external_ref}"
  end

  defp checkpoint(entries) do
    %{
      "release_count" => length(entries),
      "newest_updated_at" =>
        case entries do
          [] ->
            nil

          _ ->
            entries
            |> Enum.max_by(&DateTime.to_unix(&1.source_updated_at, :microsecond))
            |> Map.fetch!(:revision)
        end
    }
  end

  defp source_ref(connection) do
    "github:#{value(connection, :owner)}/#{value(connection, :repo)}:releases"
  end

  defp release_id(%{"id" => id}) when is_integer(id), do: {:ok, Integer.to_string(id)}
  defp release_id(%{"id" => id}) when is_binary(id) and id != "", do: {:ok, id}

  defp release_id(_release) do
    Diagnostic.error_result(
      "github_release_id_missing",
      "GitHub release response is missing its stable ID"
    )
  end

  defp required_release_string(release, key) do
    case non_empty(release[key]) do
      nil ->
        Diagnostic.error_result(
          "github_release_#{key}_missing",
          "GitHub release response is missing #{key}"
        )

      value ->
        {:ok, value}
    end
  end

  defp release_datetime(release, key) do
    case DateTime.from_iso8601(to_string(release[key] || "")) do
      {:ok, datetime, _offset} ->
        {:ok, datetime}

      _ ->
        Diagnostic.error_result(
          "github_release_#{key}_invalid",
          "GitHub release response has an invalid #{key}"
        )
    end
  end

  defp required_string(connection, key) do
    case value(connection, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "github_releases_#{key}_required",
          "GitHub Releases connection requires #{key}"
        )
    end
  end

  defp validate_boolean(connection, key, default) do
    if is_boolean(value(connection, key, default)),
      do: :ok,
      else:
        Diagnostic.error_result(
          "github_releases_#{key}_invalid",
          "GitHub Releases connection #{key} must be a boolean"
        )
  end

  defp validate_limit(limit) when is_integer(limit) and limit > 0 and limit <= @max_limit, do: :ok

  defp validate_limit(_limit) do
    Diagnostic.error_result(
      "github_releases_limit_invalid",
      "GitHub Releases connection limit must be between 1 and #{@max_limit}"
    )
  end

  defp non_empty(value) when is_binary(value) and value != "", do: value
  defp non_empty(_value), do: nil

  defp value(map, key, default \\ nil) do
    Map.get(map, key, Map.get(map, Atom.to_string(key), default))
  end
end
