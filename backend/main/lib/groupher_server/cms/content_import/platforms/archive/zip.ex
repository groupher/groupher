defmodule GroupherServer.CMS.ContentImport.Platforms.Archive.Zip do
  @moduledoc "Safely converts a ZIP archive into file/asset Entries without extracting it to disk."

  @behaviour GroupherServer.CMS.ContentImport.PlatformAdapter

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic, Snapshot}
  alias GroupherServer.CMS.ContentImport.Platforms.FileEntry

  @default_max_archive_bytes 50 * 1024 * 1024
  @default_max_files 10_000
  @default_max_file_bytes 10 * 1024 * 1024
  @default_max_total_bytes 100 * 1024 * 1024
  @default_max_compression_ratio 100

  @impl true
  def validate_connection(connection, opts) when is_map(connection) do
    with {:ok, archive} <- archive_binary(connection),
         :ok <- archive_size(archive, opts),
         {:ok, table} <- zip_table(archive),
         :ok <- preflight(table, opts) do
      :ok
    end
  end

  def validate_connection(_connection, _opts),
    do: Diagnostic.error_result("invalid_archive_connection", "ZIP connection must be a map")

  @impl true
  def fetch(connection, opts) do
    with {:ok, archive} <- archive_binary(connection),
         :ok <- archive_size(archive, opts),
         {:ok, table} <- zip_table(archive),
         :ok <- preflight(table, opts),
         {:ok, files} <- extract_memory(archive),
         {:ok, entries} <- build_entries(files),
         archive_hash <- Canonical.sha256({:raw_binary, archive}) do
      Snapshot.new(%{
        platform: :archive_zip,
        source_ref: value(connection, :source_ref, "upload:#{archive_hash}"),
        revision: archive_hash,
        entries: entries,
        fetched_at: Keyword.get(opts, :fetched_at, DateTime.utc_now()),
        adapter_version: "1"
      })
    end
  end

  defp archive_binary(connection) do
    cond do
      is_binary(value(connection, :archive)) ->
        {:ok, value(connection, :archive)}

      is_binary(value(connection, :path)) ->
        case File.read(value(connection, :path)) do
          {:ok, archive} ->
            {:ok, archive}

          {:error, reason} ->
            Diagnostic.error_result("archive_read_failed", "could not read ZIP archive",
              details: reason
            )
        end

      true ->
        Diagnostic.error_result(
          "archive_required",
          "ZIP connection requires an archive binary or local path"
        )
    end
  end

  defp archive_size(archive, opts) do
    if byte_size(archive) <= Keyword.get(opts, :max_archive_bytes, @default_max_archive_bytes),
      do: :ok,
      else:
        Diagnostic.error_result(
          "archive_size_exceeded",
          "ZIP archive exceeds the compressed size limit"
        )
  end

  defp zip_table(archive) do
    case :zip.table(archive) do
      {:ok, table} ->
        {:ok, table}

      {:error, reason} ->
        Diagnostic.error_result("invalid_zip_archive", "could not inspect ZIP archive",
          details: reason
        )
    end
  end

  defp preflight(table, opts) do
    files = Enum.reject(table, &match?({:zip_comment, _}, &1))
    max_files = Keyword.get(opts, :max_files, @default_max_files)
    max_file_bytes = Keyword.get(opts, :max_file_bytes, @default_max_file_bytes)
    max_total_bytes = Keyword.get(opts, :max_total_bytes, @default_max_total_bytes)
    max_ratio = Keyword.get(opts, :max_compression_ratio, @default_max_compression_ratio)

    Enum.reduce_while(files, {:ok, %{count: 0, total: 0}}, fn file, {:ok, totals} ->
      with {:ok, metadata} <- zip_metadata(file),
           :ok <- safe_archive_path(metadata.path),
           :ok <- regular_archive_type(metadata.type),
           :ok <- within_file_size(metadata.size, max_file_bytes),
           :ok <- within_ratio(metadata.size, metadata.compressed_size, max_ratio),
           updated = %{count: totals.count + 1, total: totals.total + metadata.size},
           :ok <- within_archive_limits(updated, max_files, max_total_bytes) do
        {:cont, {:ok, updated}}
      else
        {:skip, :directory} -> {:cont, {:ok, totals}}
        {:error, diagnostic} -> {:halt, {:error, diagnostic}}
      end
    end)
    |> case do
      {:ok, _totals} -> :ok
      error -> error
    end
  end

  defp zip_metadata(
         {:zip_file, name,
          {:file_info, size, type, _access, _atime, _mtime, _ctime, _mode, _links, _major, _minor,
           _inode, _uid, _gid}, _comment, _offset, compressed_size}
       ) do
    {:ok,
     %{
       path: name |> List.to_string() |> FileEntry.normalize_path(),
       size: size,
       type: type,
       compressed_size: compressed_size
     }}
  end

  defp zip_metadata(_entry),
    do:
      Diagnostic.error_result(
        "unsupported_zip_entry",
        "ZIP archive contains an unsupported entry"
      )

  defp safe_archive_path(path) do
    if path != "" and Path.type(path) == :relative and not Enum.member?(Path.split(path), ".."),
      do: :ok,
      else:
        Diagnostic.error_result("unsafe_zip_path", "ZIP entry escapes the archive root",
          file: path
        )
  end

  defp regular_archive_type(:directory), do: {:skip, :directory}
  defp regular_archive_type(:regular), do: :ok

  defp regular_archive_type(_type),
    do:
      Diagnostic.error_result(
        "unsafe_zip_entry_type",
        "ZIP symlinks and special files are not allowed"
      )

  defp within_file_size(size, max) when size <= max, do: :ok

  defp within_file_size(_size, _max),
    do: Diagnostic.error_result("zip_file_size_exceeded", "ZIP contains an oversized file")

  defp within_ratio(0, _compressed_size, _max), do: :ok

  defp within_ratio(size, compressed_size, limit) do
    if size / max(compressed_size, 1) <= limit,
      do: :ok,
      else:
        Diagnostic.error_result(
          "zip_compression_ratio_exceeded",
          "ZIP entry has a suspicious compression ratio"
        )
  end

  defp within_archive_limits(%{count: count, total: total}, max_files, max_total_bytes) do
    cond do
      count > max_files ->
        Diagnostic.error_result("zip_file_limit_exceeded", "ZIP contains too many files")

      total > max_total_bytes ->
        Diagnostic.error_result(
          "zip_total_size_exceeded",
          "ZIP exceeds the total extracted size limit"
        )

      true ->
        :ok
    end
  end

  defp extract_memory(archive) do
    case :zip.extract(archive, [:memory]) do
      {:ok, files} ->
        {:ok, files}

      {:error, reason} ->
        Diagnostic.error_result("zip_extract_failed", "could not read ZIP contents",
          details: reason
        )
    end
  end

  defp build_entries(files) do
    files
    |> Enum.reduce_while({:ok, []}, fn {name, body}, {:ok, entries} ->
      path = name |> List.to_string() |> FileEntry.normalize_path()

      if FileEntry.allowed_path?(path) do
        case FileEntry.build(path, body) do
          {:ok, entry} -> {:cont, {:ok, [entry | entries]}}
          {:error, diagnostic} -> {:halt, {:error, diagnostic}}
        end
      else
        {:cont, {:ok, entries}}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end

  defp value(map, key, default \\ nil) do
    Map.get(map, key, Map.get(map, Atom.to_string(key), default))
  end
end
