defmodule GroupherServer.CMS.ContentImport.Workspace do
  @moduledoc "Materializes file and asset Entries into an isolated read-only directory."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Entry, Snapshot}

  @default_max_files 10_000
  @default_max_file_bytes 10 * 1024 * 1024
  @default_max_total_bytes 100 * 1024 * 1024

  @enforce_keys [:root]
  defstruct [:root]

  @type t :: %__MODULE__{root: Path.t()}

  @spec materialize(Snapshot.t(), keyword()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def materialize(%Snapshot{} = snapshot, opts \\ []) do
    entries = Enum.filter(snapshot.entries, &(&1.kind in [:file, :asset]))

    with :ok <- validate_limits(entries, opts),
         {:ok, root} <- create_root(opts),
         :ok <- write_entries(root, entries) do
      make_read_only(root)
      {:ok, %__MODULE__{root: root}}
    end
  end

  @spec cleanup(t()) :: :ok | {:error, term(), Path.t()}
  def cleanup(%__MODULE__{root: root}) do
    make_writable(root)

    case File.rm_rf(root) do
      {:ok, _paths} -> :ok
      {:error, reason, path} -> {:error, reason, path}
    end
  end

  defp create_root(opts) do
    parent = Keyword.get(opts, :parent, System.tmp_dir!())
    name = "content-import-#{System.unique_integer([:positive, :monotonic])}"
    root = Path.join(parent, name)

    case File.mkdir_p(root) do
      :ok ->
        {:ok, root}

      {:error, reason} ->
        Diagnostic.error_result("workspace_create_failed", "could not create import workspace",
          details: reason
        )
    end
  end

  defp validate_limits(entries, opts) do
    max_files = Keyword.get(opts, :max_files, @default_max_files)
    max_file_bytes = Keyword.get(opts, :max_file_bytes, @default_max_file_bytes)
    max_total_bytes = Keyword.get(opts, :max_total_bytes, @default_max_total_bytes)
    sizes = Enum.map(entries, &entry_size/1)

    cond do
      length(entries) > max_files ->
        Diagnostic.error_result(
          "workspace_file_limit_exceeded",
          "workspace contains too many files"
        )

      Enum.any?(sizes, &(&1 > max_file_bytes)) ->
        Diagnostic.error_result(
          "workspace_file_size_exceeded",
          "workspace contains an oversized file"
        )

      Enum.sum(sizes) > max_total_bytes ->
        Diagnostic.error_result(
          "workspace_total_size_exceeded",
          "workspace exceeds the total size limit"
        )

      true ->
        :ok
    end
  end

  defp entry_size(%Entry{body: body}) when is_binary(body), do: byte_size(body)
  defp entry_size(_entry), do: 0

  defp write_entries(root, entries) do
    Enum.reduce_while(entries, :ok, fn entry, :ok ->
      with {:ok, relative_path} <- safe_relative_path(entry.path),
           true <- is_binary(entry.body),
           destination <- Path.join(root, relative_path),
           :ok <- File.mkdir_p(Path.dirname(destination)),
           :ok <- File.write(destination, entry.body) do
        {:cont, :ok}
      else
        {:error, %{code: _code} = diagnostic} ->
          {:halt, {:error, diagnostic}}

        false ->
          {:halt,
           Diagnostic.error_result(
             "workspace_entry_body_required",
             "file Entries require a binary body"
           )}

        {:error, reason} ->
          {:halt,
           Diagnostic.error_result("workspace_write_failed", "could not write import workspace",
             details: reason
           )}
      end
    end)
  end

  defp safe_relative_path(path) when is_binary(path) and path != "" do
    normalized = String.replace(path, "\\", "/")

    if Path.type(normalized) == :relative and not Enum.member?(Path.split(normalized), "..") do
      {:ok, normalized}
    else
      Diagnostic.error_result(
        "unsafe_workspace_path",
        "workspace Entry path must stay below its root",
        file: path
      )
    end
  end

  defp safe_relative_path(path),
    do:
      Diagnostic.error_result("workspace_entry_path_required", "file Entries require a path",
        file: path
      )

  defp make_read_only(root) do
    root
    |> descendants()
    |> Enum.each(fn path -> File.chmod(path, if(File.dir?(path), do: 0o555, else: 0o444)) end)

    File.chmod(root, 0o555)
  end

  defp make_writable(root) do
    if File.exists?(root) do
      File.chmod(root, 0o755)

      root
      |> descendants()
      |> Enum.each(fn path -> File.chmod(path, if(File.dir?(path), do: 0o755, else: 0o644)) end)
    end
  end

  defp descendants(root) do
    case File.ls(root) do
      {:ok, names} ->
        Enum.flat_map(names, fn name ->
          path = Path.join(root, name)
          if File.dir?(path), do: [path | descendants(path)], else: [path]
        end)

      _ ->
        []
    end
  end
end
