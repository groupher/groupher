defmodule GroupherServer.CMS.ContentImport.Platforms.GitHub.Repository do
  @moduledoc "Fetches one GitHub repository/ref/path into an immutable file Snapshot."

  @behaviour GroupherServer.CMS.ContentImport.PlatformAdapter

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Snapshot}
  alias GroupherServer.CMS.ContentImport.Platforms.FileEntry
  alias GroupherServer.CMS.ContentImport.Platforms.GitHub.Client

  @default_max_files 5_000
  @default_max_file_bytes 10 * 1024 * 1024
  @default_max_total_bytes 100 * 1024 * 1024

  @impl true
  def validate_connection(connection, _opts) when is_map(connection) do
    with {:ok, _owner} <- required_string(connection, :owner),
         {:ok, _repo} <- required_string(connection, :repo),
         {:ok, _ref} <- required_string(connection, :ref, "main"),
         :ok <- validate_prefix(value(connection, :path, "")) do
      :ok
    end
  end

  def validate_connection(_connection, _opts),
    do:
      Diagnostic.error_result(
        "invalid_github_connection",
        "GitHub repository connection must be a map"
      )

  @impl true
  def fetch(connection, opts) do
    client = Keyword.get(opts, :client, Client)

    with :ok <- validate_connection(connection, opts),
         {:ok, repository} <- client.fetch_repository(connection, opts),
         :ok <- reject_truncated(repository),
         {:ok, blobs} <- select_blobs(repository.entries, connection, opts),
         {:ok, entries} <- fetch_entries(blobs, connection, client, opts) do
      Snapshot.new(%{
        platform: :github_repository,
        source_ref: source_ref(connection),
        revision: repository.head_sha,
        entries: entries,
        fetched_at: Keyword.get(opts, :fetched_at, DateTime.utc_now()),
        adapter_version: "1"
      })
    end
  end

  defp reject_truncated(%{truncated: true}) do
    Diagnostic.error_result(
      "github_tree_truncated",
      "GitHub returned a truncated repository tree; refusing to import incomplete content"
    )
  end

  defp reject_truncated(_repository), do: :ok

  defp select_blobs(tree, connection, opts) when is_list(tree) do
    prefix = normalize_prefix(value(connection, :path, ""))

    blobs =
      tree
      |> Enum.filter(&(&1["type"] == "blob"))
      |> Enum.filter(&within_prefix?(&1["path"], prefix))
      |> Enum.map(&Map.put(&1, "relative_path", relative_path(&1["path"], prefix)))
      |> Enum.filter(&FileEntry.allowed_path?(&1["relative_path"]))

    validate_blob_limits(blobs, opts)
  end

  defp select_blobs(_tree, _connection, _opts),
    do: Diagnostic.error_result("github_tree_invalid", "GitHub repository tree is invalid")

  defp validate_blob_limits(blobs, opts) do
    max_files = Keyword.get(opts, :max_files, @default_max_files)
    max_file_bytes = Keyword.get(opts, :max_file_bytes, @default_max_file_bytes)
    max_total_bytes = Keyword.get(opts, :max_total_bytes, @default_max_total_bytes)
    sizes = Enum.map(blobs, &(Map.get(&1, "size", 0) || 0))

    cond do
      length(blobs) > max_files ->
        Diagnostic.error_result(
          "github_file_limit_exceeded",
          "GitHub repository contains too many importable files"
        )

      Enum.any?(sizes, &(&1 > max_file_bytes)) ->
        Diagnostic.error_result(
          "github_file_size_exceeded",
          "GitHub repository contains an oversized file"
        )

      Enum.sum(sizes) > max_total_bytes ->
        Diagnostic.error_result(
          "github_total_size_exceeded",
          "GitHub repository exceeds the total import size limit"
        )

      true ->
        {:ok, blobs}
    end
  end

  defp fetch_entries(blobs, connection, client, opts) do
    concurrency = Keyword.get(opts, :max_concurrency, 4)
    timeout = Keyword.get(opts, :blob_timeout, 30_000)

    blobs
    |> Task.async_stream(
      fn blob -> fetch_entry(blob, connection, client, opts) end,
      max_concurrency: concurrency,
      timeout: timeout,
      ordered: true,
      on_timeout: :kill_task
    )
    |> Enum.reduce_while({:ok, []}, fn
      {:ok, {:ok, entry}}, {:ok, entries} ->
        {:cont, {:ok, [entry | entries]}}

      {:ok, {:error, diagnostic}}, _acc ->
        {:halt, {:error, diagnostic}}

      {:exit, reason}, _acc ->
        {:halt,
         Diagnostic.error_result("github_blob_timeout", "GitHub blob fetch did not complete",
           details: reason
         )}
    end)
    |> case do
      {:ok, entries} ->
        entries = Enum.reverse(entries)

        if Enum.sum(Enum.map(entries, &byte_size(&1.body))) <=
             Keyword.get(opts, :max_total_bytes, @default_max_total_bytes) do
          {:ok, entries}
        else
          Diagnostic.error_result(
            "github_total_size_exceeded",
            "downloaded GitHub repository content exceeds the total import size limit"
          )
        end

      error ->
        error
    end
  end

  defp fetch_entry(blob, connection, client, opts) do
    with {:ok, body} <- client.fetch_blob(connection, blob, opts),
         :ok <- validate_downloaded_size(body, opts) do
      FileEntry.build(blob["relative_path"], body,
        revision: blob["sha"],
        source_url: source_url(connection, blob["path"]),
        metadata: %{size: byte_size(body), github_blob_sha: blob["sha"]}
      )
    end
  end

  defp validate_downloaded_size(body, opts) do
    if byte_size(body) <= Keyword.get(opts, :max_file_bytes, @default_max_file_bytes),
      do: :ok,
      else:
        Diagnostic.error_result(
          "github_file_size_exceeded",
          "GitHub blob exceeds the file size limit"
        )
  end

  defp source_ref(connection) do
    owner = value(connection, :owner)
    repo = value(connection, :repo)
    ref = value(connection, :ref, "main")
    path = normalize_prefix(value(connection, :path, ""))
    "github:#{owner}/#{repo}@#{ref}:#{path}"
  end

  defp source_url(connection, path) do
    owner = value(connection, :owner)
    repo = value(connection, :repo)
    ref = value(connection, :ref, "main")
    "https://github.com/#{owner}/#{repo}/blob/#{URI.encode(ref)}/#{path}"
  end

  defp within_prefix?(_path, ""), do: true

  defp within_prefix?(path, prefix),
    do: path == prefix or String.starts_with?(path, prefix <> "/")

  defp relative_path(path, ""), do: path
  defp relative_path(path, prefix), do: Path.relative_to(path, prefix)

  defp validate_prefix(prefix) when is_binary(prefix) do
    normalized = normalize_prefix(prefix)

    if Path.type(normalized) == :relative and not Enum.member?(Path.split(normalized), ".."),
      do: :ok,
      else:
        Diagnostic.error_result(
          "unsafe_github_path",
          "GitHub repository path must stay below the repository root"
        )
  end

  defp validate_prefix(_prefix),
    do: Diagnostic.error_result("invalid_github_path", "GitHub repository path must be a string")

  defp normalize_prefix(prefix), do: prefix |> FileEntry.normalize_path() |> String.trim("/")

  defp required_string(map, key, default \\ nil) do
    case value(map, key, default) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "github_#{key}_required",
          "GitHub repository #{key} must be a non-empty string"
        )
    end
  end

  defp value(map, key, default \\ nil) do
    Map.get(map, key, Map.get(map, Atom.to_string(key), default))
  end
end
