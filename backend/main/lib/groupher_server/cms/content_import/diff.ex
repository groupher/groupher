defmodule GroupherServer.CMS.ContentImport.Diff do
  @moduledoc """
  Derives source/local synchronization state from a Snapshot and persisted
  Mapping checkpoints. Diff is intentionally computed rather than stored as a
  second source of truth.
  """

  alias GroupherServer.CMS.ContentImport.{Mapping, Snapshot}

  @statuses [:new, :in_sync, :source_updated, :local_updated, :conflict, :source_deleted]

  @enforce_keys [:items, :summary]
  defstruct items: [], summary: %{}

  @type status ::
          :new | :in_sync | :source_updated | :local_updated | :conflict | :source_deleted

  @type item :: %{
          required(:external_ref) => String.t(),
          required(:target_ref) => String.t() | nil,
          required(:status) => status(),
          required(:source_hash) => String.t() | nil,
          required(:local_hash) => String.t() | nil
        }

  @type t :: %__MODULE__{items: [item()], summary: %{status() => non_neg_integer()}}

  @spec build(Snapshot.t(), [Mapping.t() | map()], map()) :: t()
  def build(%Snapshot{} = snapshot, mappings, local_hashes \\ %{})
      when is_list(mappings) and is_map(local_hashes) do
    mappings_by_ref = Map.new(mappings, &{mapping_value(&1, :external_ref), &1})
    snapshot_refs = MapSet.new(snapshot.entries, & &1.external_ref)

    current_items =
      Enum.map(snapshot.entries, fn entry ->
        mapping = Map.get(mappings_by_ref, entry.external_ref)
        current_item(entry.external_ref, entry.content_hash, mapping, local_hashes)
      end)

    deleted_items =
      mappings
      |> Enum.reject(&MapSet.member?(snapshot_refs, mapping_value(&1, :external_ref)))
      |> Enum.map(fn mapping ->
        target_ref = mapping_value(mapping, :target_ref)

        %{
          external_ref: mapping_value(mapping, :external_ref),
          target_ref: target_ref,
          status: :source_deleted,
          source_hash: nil,
          local_hash: Map.get(local_hashes, target_ref)
        }
      end)

    items = Enum.sort_by(current_items ++ deleted_items, & &1.external_ref)
    %__MODULE__{items: items, summary: summary(items)}
  end

  @spec statuses() :: [status()]
  def statuses, do: @statuses

  defp current_item(external_ref, source_hash, nil, _local_hashes) do
    %{
      external_ref: external_ref,
      target_ref: nil,
      status: :new,
      source_hash: source_hash,
      local_hash: nil
    }
  end

  defp current_item(external_ref, source_hash, mapping, local_hashes) do
    target_ref = mapping_value(mapping, :target_ref)
    imported_source_hash = mapping_value(mapping, :last_imported_source_hash)
    imported_local_hash = mapping_value(mapping, :last_imported_local_hash)
    local_hash = Map.get(local_hashes, target_ref, imported_local_hash)

    %{
      external_ref: external_ref,
      target_ref: target_ref,
      status: diff_status(source_hash, imported_source_hash, local_hash, imported_local_hash),
      source_hash: source_hash,
      local_hash: local_hash
    }
  end

  defp diff_status(source_hash, source_hash, local_hash, local_hash), do: :in_sync

  defp diff_status(source_hash, source_hash, _local_hash, _imported_local_hash),
    do: :local_updated

  defp diff_status(_source_hash, _imported_source_hash, local_hash, local_hash),
    do: :source_updated

  defp diff_status(_source_hash, nil, _local_hash, _imported_local_hash), do: :source_updated

  defp diff_status(_source_hash, _imported_source_hash, _local_hash, _imported_local_hash),
    do: :conflict

  defp summary(items) do
    initial = Map.new(@statuses, &{&1, 0})
    Enum.reduce(items, initial, &Map.update!(&2, &1.status, fn count -> count + 1 end))
  end

  defp mapping_value(%Mapping{} = mapping, key), do: Map.get(mapping, key)

  defp mapping_value(mapping, key) when is_map(mapping),
    do: Map.get(mapping, key, Map.get(mapping, Atom.to_string(key)))
end
