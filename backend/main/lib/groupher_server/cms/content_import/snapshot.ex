defmodule GroupherServer.CMS.ContentImport.Snapshot do
  @moduledoc "Immutable result of one PlatformAdapter fetch."

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic, Entry}

  @manifest_hash_version 1

  @enforce_keys [
    :platform,
    :source_ref,
    :entries,
    :fetched_at,
    :manifest_hash,
    :manifest_hash_version,
    :entry_hash_version,
    :normalization_version
  ]
  defstruct [
    :platform,
    :source_ref,
    :revision,
    :checkpoint,
    :fetched_at,
    :manifest_hash,
    :adapter_version,
    entries: [],
    diagnostics: [],
    manifest_hash_version: @manifest_hash_version,
    entry_hash_version: Entry.hash_version(),
    normalization_version: Entry.normalization_version()
  ]

  @type t :: %__MODULE__{
          platform: atom(),
          source_ref: String.t(),
          revision: String.t() | nil,
          checkpoint: map() | nil,
          entries: [Entry.t()],
          fetched_at: DateTime.t(),
          manifest_hash: String.t(),
          manifest_hash_version: pos_integer(),
          entry_hash_version: pos_integer(),
          normalization_version: pos_integer(),
          adapter_version: String.t() | nil,
          diagnostics: [Diagnostic.t()]
        }

  @spec manifest_hash_version() :: pos_integer()
  def manifest_hash_version, do: @manifest_hash_version

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    entries = value(attrs, :entries, [])

    with {:ok, platform} <- platform(attrs),
         {:ok, source_ref} <- required_string(attrs, :source_ref),
         :ok <- validate_entries(entries),
         :ok <- unique_external_refs(entries),
         {:ok, fetched_at} <- fetched_at(attrs),
         :ok <- validate_checkpoint(value(attrs, :checkpoint)) do
      snapshot = %__MODULE__{
        platform: platform,
        source_ref: source_ref,
        revision: value(attrs, :revision),
        checkpoint: value(attrs, :checkpoint),
        entries: entries,
        fetched_at: fetched_at,
        manifest_hash: "",
        manifest_hash_version: @manifest_hash_version,
        entry_hash_version: Entry.hash_version(),
        normalization_version: Entry.normalization_version(),
        adapter_version: value(attrs, :adapter_version),
        diagnostics: value(attrs, :diagnostics, [])
      }

      {:ok, %{snapshot | manifest_hash: manifest_hash(snapshot)}}
    end
  rescue
    error in ArgumentError ->
      Diagnostic.error_result("invalid_snapshot_content", Exception.message(error))
  end

  def new(_attrs),
    do: Diagnostic.error_result("invalid_snapshot", "snapshot attributes must be a map")

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, snapshot} -> snapshot
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec manifest_hash(t()) :: String.t()
  def manifest_hash(%__MODULE__{} = snapshot) do
    entries =
      snapshot.entries
      |> Enum.sort_by(& &1.external_ref)
      |> Enum.map(fn entry ->
        [
          entry.external_ref,
          entry.content_hash,
          entry.hash_version,
          entry.normalization_version
        ]
      end)

    %{
      platform: Atom.to_string(snapshot.platform),
      source_ref: snapshot.source_ref,
      manifest_hash_version: snapshot.manifest_hash_version,
      adapter_version: snapshot.adapter_version,
      entries: entries
    }
    |> Canonical.sha256()
  end

  defp platform(attrs) do
    case value(attrs, :platform) do
      platform when is_atom(platform) and not is_nil(platform) ->
        {:ok, platform}

      _ ->
        Diagnostic.error_result("snapshot_platform_required", "snapshot platform must be an atom")
    end
  end

  defp required_string(attrs, key) do
    case value(attrs, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "snapshot_#{key}_required",
          "snapshot #{key} must be a non-empty string"
        )
    end
  end

  defp fetched_at(attrs) do
    case value(attrs, :fetched_at) do
      %DateTime{} = fetched_at ->
        {:ok, fetched_at}

      _ ->
        Diagnostic.error_result(
          "snapshot_fetched_at_required",
          "snapshot fetched_at must be a UTC DateTime"
        )
    end
  end

  defp validate_entries(entries) when is_list(entries) do
    if Enum.all?(entries, &match?(%Entry{}, &1)),
      do: :ok,
      else:
        Diagnostic.error_result(
          "invalid_snapshot_entries",
          "snapshot entries must contain Entry structs"
        )
  end

  defp validate_entries(_entries),
    do: Diagnostic.error_result("invalid_snapshot_entries", "snapshot entries must be a list")

  defp unique_external_refs(entries) do
    refs = Enum.map(entries, & &1.external_ref)

    if length(refs) == MapSet.size(MapSet.new(refs)),
      do: :ok,
      else:
        Diagnostic.error_result(
          "duplicate_entry_external_ref",
          "snapshot entry external_ref values must be unique"
        )
  end

  defp validate_checkpoint(nil), do: :ok
  defp validate_checkpoint(checkpoint) when is_map(checkpoint), do: :ok

  defp validate_checkpoint(_checkpoint),
    do:
      Diagnostic.error_result("invalid_snapshot_checkpoint", "snapshot checkpoint must be a map")

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
